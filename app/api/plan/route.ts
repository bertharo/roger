import { NextRequest } from 'next/server';
import { generateWeeklyPlan } from '@/lib/planGenerator';
import { Run, Goal } from '@/lib/types';
import { getUserId } from '@/lib/auth/getSession';
import { checkPlanRateLimit, incrementPlanUsage } from '@/lib/rateLimit';
import { checkGlobalCostLimit } from '@/lib/rateLimit';
import { logger } from '@/lib/utils/logger';
import { assessmentToRuns } from '@/lib/fitness/assessmentToRuns';
import { queryOne } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Force dynamic rendering

export async function GET(request: NextRequest) {
  try {
    const weekStart = request.nextUrl.searchParams.get('weekStart');
    
    // Try to load Strava data first
    let runs: Run[] = [];
    let hasStravaData = false;
    
    try {
      let userId: string | null = null;
      try {
        userId = await getUserId();
      } catch (e) {
        // getUserId can fail if no session or database issues - that's okay for GET
        logger.debug('Could not get user ID (non-critical for GET):', e);
      }
      
      // Try database first (for logged-in users)
      if (userId) {
        try {
          const stravaResponse = await fetch(`${request.nextUrl.origin}/api/strava/activities`, {
            headers: {
              cookie: request.headers.get('cookie') || '',
            },
          });
          
          if (stravaResponse.ok) {
            const stravaData = await stravaResponse.json();
            if (stravaData.runs && stravaData.runs.length > 0) {
              runs = stravaData.runs;
              hasStravaData = true;
            }
          }
        } catch (e) {
          logger.error('Error loading Strava data from API:', e);
        }
      }
      
      // Fallback to cookie-based Strava token
      if (!hasStravaData) {
        const cookieHeader = request.headers.get('cookie') || '';
        const tokenCookie = cookieHeader
          .split(';')
          .find(c => c.trim().startsWith('strava_access_token='));
        
        if (tokenCookie) {
          const accessToken = tokenCookie.split('=')[1].trim();
          const stravaResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });
          
          if (stravaResponse.ok) {
            const activities = await stravaResponse.json();
            const runActivities = activities
              .filter((a: any) => a.type === 'Run')
              .map((a: any) => ({
                id: String(a.id),
                date: a.start_date,
                distanceMiles: a.distance / 1609.34,
                durationSeconds: a.moving_time || a.elapsed_time,
                averagePaceMinPerMile: (a.moving_time || a.elapsed_time) / 60 / (a.distance / 1609.34),
                type: inferRunType(a),
                elevationFeet: a.total_elevation_gain ? a.total_elevation_gain * 3.28084 : undefined,
                notes: a.name,
              }));
            
            if (runActivities.length > 0) {
              runs = runActivities;
              hasStravaData = true;
            }
          }
        }
      }
      
      // If no Strava data, try fitness assessment
      if (!hasStravaData && userId) {
        try {
          // Check if DATABASE_URL is configured before attempting query
          if (process.env.DATABASE_URL) {
            const assessment = await queryOne<{
              fitness_level: string;
              weekly_mileage: number;
              days_per_week: number;
              easy_pace_min_per_mile: number | null;
              recent_running_experience: string;
              longest_run_miles: number | null;
              completed_at: string;
            }>`
              SELECT fitness_level, weekly_mileage, days_per_week, easy_pace_min_per_mile, 
               recent_running_experience, longest_run_miles, completed_at
               FROM fitness_assessments 
               WHERE user_id = ${userId} 
               ORDER BY completed_at DESC 
               LIMIT 1
            `;
            
            if (assessment) {
              assessmentData = {
                fitnessLevel: assessment.fitness_level as 'beginner' | 'intermediate' | 'advanced',
                weeklyMileage: assessment.weekly_mileage,
                daysPerWeek: assessment.days_per_week,
                easyPaceMinPerMile: assessment.easy_pace_min_per_mile ?? undefined,
                recentRunningExperience: assessment.recent_running_experience as 'none' | 'some' | 'regular',
                longestRunMiles: assessment.longest_run_miles ?? undefined,
                completedAt: assessment.completed_at,
              };
              runs = assessmentToRuns(assessmentData);
              logger.info('Using fitness assessment data for plan generation');
            }
          }
        } catch (dbError: any) {
          // Silently handle database errors - table might not exist or DB not configured
          if (dbError.message?.includes('does not exist') || dbError.message?.includes('DATABASE_URL')) {
            logger.debug('Fitness assessments table not available:', dbError.message);
          } else {
            logger.error('Error loading fitness assessment:', dbError);
          }
        }
      }
      
      // No mock data fallback - return error if no data
      if (runs.length === 0) {
        logger.warn('No run data available - no Strava connection or fitness assessment');
        return Response.json(
          { error: 'No run data available. Please connect Strava or complete a fitness assessment.' },
          { status: 400 }
        );
      }
    } catch (e) {
      logger.error('Error loading run data:', e);
      return Response.json(
        { error: 'Failed to load run data' },
        { status: 500 }
      );
    }
    
    // Try to load goal from API
    let goal: Goal | null = null;
    try {
      const cookieHeader = request.headers.get('cookie') || '';
      const goalCookie = cookieHeader
        .split(';')
        .find(c => c.trim().startsWith('user_goal='));
      
      if (goalCookie) {
        try {
          const goalJson = decodeURIComponent(goalCookie.split('=')[1]);
          const savedGoal = JSON.parse(goalJson);
          // Convert dashboard format to core format
          goal = {
            raceDate: savedGoal.raceDateISO,
            distance: savedGoal.distanceMi,
            targetTimeMinutes: savedGoal.targetTimeMinutes,
          };
        } catch (e) {
          // Invalid cookie, use mock data
        }
      }
    } catch (e) {
      // Error loading goal, use mock data
    }
    
    // Validate goal before generating plan
    if (!goal || !goal.raceDate || !goal.distance || !goal.targetTimeMinutes) {
      logger.error('Invalid goal data:', goal);
      return Response.json(
        { error: 'Invalid goal data. Please set your race goal in settings.' },
        { status: 400 }
      );
    }
    
    // Get most recent 5 runs for pace inference
    const sortedRuns = [...runs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const recentRuns = sortedRuns.slice(0, 5);
    
    // Calculate target weekly mileage if using assessment
    let targetWeeklyMiles: number | undefined = undefined;
    if (assessmentData && !hasStravaData) {
      // Use assessment weekly mileage as starting point
      targetWeeklyMiles = assessmentData.weeklyMileage;
    }
    
    try {
      const plan = generateWeeklyPlan(goal, recentRuns, weekStart || undefined, assessmentData, targetWeeklyMiles);
      
      if (!plan || !plan.days || plan.days.length === 0) {
        logger.error('Plan generation returned invalid plan');
        return Response.json(
          { error: 'Failed to generate valid plan' },
          { status: 500 }
        );
      }
      
      return Response.json(plan);
    } catch (planError) {
      logger.error('Error in generateWeeklyPlan:', planError);
      return Response.json(
        { error: 'Failed to generate plan. Please check your goal settings.' },
        { status: 500 }
      );
    }
    } catch (error) {
      logger.error('Error generating plan:', error);
    return Response.json(
      { error: 'Failed to generate plan' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    
    if (!userId) {
      return Response.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check global cost limit (for consistency, even though plan generation doesn't use OpenAI)
    const globalLimit = await checkGlobalCostLimit();
    if (!globalLimit.allowed) {
      return Response.json(
        {
          error: 'Service temporarily unavailable due to high demand. Please try again tomorrow.',
          errorType: 'global_limit_exceeded',
        },
        { status: 503 }
      );
    }
    
    // Check user rate limit for plan generation
    const rateLimit = await checkPlanRateLimit(userId);
    if (!rateLimit.allowed) {
      return Response.json(
        {
          error: `Daily limit reached. You've used ${rateLimit.limit} plan generations today. Your limit resets at ${rateLimit.resetAt.toLocaleTimeString()}.`,
          errorType: 'rate_limit_exceeded',
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt.toISOString(),
        },
        { status: 429 }
      );
    }
    
    const body = await request.json();
    const { runs: providedRuns, goal: providedGoal, weekStart } = body;
    
    // Use provided runs or try to load from Strava or fitness assessment
    let runs: Run[] = [];
    let hasStravaData = false;
    let hasRealData = false;
    let assessmentData: FitnessAssessment | undefined = undefined;
    
    // If no runs provided or runs are empty, try to load real data
    if (!providedRuns || (Array.isArray(providedRuns) && providedRuns.length === 0)) {
      // Try to load Strava data
      try {
        const cookieHeader = request.headers.get('cookie') || '';
        const tokenCookie = cookieHeader
          .split(';')
          .find(c => c.trim().startsWith('strava_access_token='));
        
        if (tokenCookie) {
          const accessToken = tokenCookie.split('=')[1].trim();
          const stravaResponse = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', {
            headers: {
              'Authorization': `Bearer ${accessToken}`,
            },
          });
          
          if (stravaResponse.ok) {
            const activities = await stravaResponse.json();
            const runActivities = activities
              .filter((a: any) => a.type === 'Run')
              .map((a: any) => ({
                id: String(a.id),
                date: a.start_date,
                distanceMiles: a.distance / 1609.34,
                durationSeconds: a.moving_time || a.elapsed_time,
                averagePaceMinPerMile: (a.moving_time || a.elapsed_time) / 60 / (a.distance / 1609.34),
                type: inferRunType(a),
                elevationFeet: a.total_elevation_gain ? a.total_elevation_gain * 3.28084 : undefined,
                notes: a.name,
              }));
            
            if (runActivities.length > 0) {
              runs = runActivities;
              hasStravaData = true;
              hasRealData = true;
            }
          }
        }
        
        // If no Strava data, try fitness assessment
        if (!hasStravaData) {
          let assessmentFound = false;
          try {
            // Check if DATABASE_URL is configured before attempting query
            if (process.env.DATABASE_URL && userId) {
              logger.debug('Checking for fitness assessment for user:', userId);
              const assessment = await queryOne<{
                fitness_level: string;
                weekly_mileage: number;
                days_per_week: number;
                easy_pace_min_per_mile: number | null;
                recent_running_experience: string;
                longest_run_miles: number | null;
                completed_at: string;
              }>`
                SELECT fitness_level, weekly_mileage, days_per_week, easy_pace_min_per_mile, 
                 recent_running_experience, longest_run_miles, completed_at
                 FROM fitness_assessments 
                 WHERE user_id = ${userId} 
                 ORDER BY completed_at DESC 
                 LIMIT 1
              `;
              
              if (assessment) {
                logger.info('Found fitness assessment in database, converting to runs:', {
                  fitnessLevel: assessment.fitness_level,
                  weeklyMileage: assessment.weekly_mileage,
                });
                assessmentData = {
                  fitnessLevel: assessment.fitness_level as 'beginner' | 'intermediate' | 'advanced',
                  weeklyMileage: assessment.weekly_mileage,
                  daysPerWeek: assessment.days_per_week,
                  easyPaceMinPerMile: assessment.easy_pace_min_per_mile ?? undefined,
                  recentRunningExperience: assessment.recent_running_experience as 'none' | 'some' | 'regular',
                  longestRunMiles: assessment.longest_run_miles ?? undefined,
                  completedAt: assessment.completed_at,
                };
                runs = assessmentToRuns(assessmentData);
                hasRealData = true;
                assessmentFound = true;
                logger.info(`Using fitness assessment data for plan generation - generated ${runs.length} runs`);
              } else {
                logger.debug('No fitness assessment found in database for user:', userId);
              }
            } else {
              logger.debug('Skipping fitness assessment database check - DATABASE_URL or userId missing');
            }
          } catch (dbError: any) {
            if (dbError.message?.includes('does not exist') || dbError.code === '42P01') {
              logger.debug('Fitness assessments table does not exist, checking localStorage fallback');
            } else {
              logger.error('Error loading fitness assessment from database:', dbError);
            }
          }
          
          // Fallback to localStorage if database check didn't find anything
          if (!assessmentFound) {
            try {
              const cookieHeader = request.headers.get('cookie') || '';
              // Note: localStorage is client-side only, so we can't access it from the server
              // But we can check if the assessment was passed in the request body
              logger.debug('No assessment found in database, will use mock data as fallback');
            } catch (e) {
              logger.debug('Could not check localStorage fallback (expected on server)');
            }
          }
        }
        
        // No mock data fallback - return error if no data
        if (!hasRealData && runs.length === 0) {
          logger.warn('No run data available - no Strava connection or fitness assessment');
          return Response.json(
            { error: 'No run data available. Please connect Strava or complete a fitness assessment.' },
            { status: 400 }
          );
        }
      } catch (e) {
        logger.error('Error loading run data:', e);
        return Response.json(
          { error: 'Failed to load run data' },
          { status: 500 }
        );
      }
    } else if (providedRuns && providedRuns.length > 0) {
      // Provided runs are real data
      runs = providedRuns;
      hasRealData = true;
    }
    
    // Use provided goal or load from cookies
    let goal: Goal | null = providedGoal || null;
    if (!providedGoal) {
      try {
        const cookieHeader = request.headers.get('cookie') || '';
        const goalCookie = cookieHeader
          .split(';')
          .find(c => c.trim().startsWith('user_goal='));
        
        if (goalCookie) {
          try {
            const goalJson = decodeURIComponent(goalCookie.split('=')[1]);
            const savedGoal = JSON.parse(goalJson);
            goal = {
              raceDate: savedGoal.raceDateISO,
              distance: savedGoal.distanceMi,
              targetTimeMinutes: savedGoal.targetTimeMinutes,
            };
          } catch (e) {
            // Invalid cookie
          }
        }
      } catch (e) {
        // Error loading goal
      }
    }
    
    // Validate goal before generating plan
    if (!goal || !goal.raceDate || !goal.distance || !goal.targetTimeMinutes) {
      logger.warn('Invalid or missing goal data');
      return Response.json(
        { error: 'Invalid goal data. Please set your race goal in settings.' },
        { status: 400 }
      );
    }
    
    // Get most recent 5 runs for pace inference
    const sortedRuns = [...runs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const recentRuns = sortedRuns.slice(0, 5);
    
    // Calculate target weekly mileage if using assessment
    let targetWeeklyMiles: number | undefined = undefined;
    if (assessmentData && !hasStravaData) {
      // Use assessment weekly mileage as starting point
      targetWeeklyMiles = assessmentData.weeklyMileage;
    }
    
    const plan = generateWeeklyPlan(goal, recentRuns, weekStart || undefined, assessmentData, targetWeeklyMiles);
    
    // Track plan generation usage
    await incrementPlanUsage(userId);
    
    // Get updated rate limit info
    const updatedRateLimit = await checkPlanRateLimit(userId);
    
    return Response.json({
      ...plan,
      usage: {
        remaining: updatedRateLimit.remaining,
        limit: updatedRateLimit.limit,
        resetAt: updatedRateLimit.resetAt.toISOString(),
      },
    });
    } catch (error) {
      logger.error('Error generating plan:', error);
    return Response.json(
      { error: 'Failed to generate plan' },
      { status: 500 }
    );
  }
}

function inferRunType(activity: any): 'easy' | 'tempo' | 'interval' | 'long' | 'race' | 'recovery' {
  const name = (activity.name || '').toLowerCase();
  const distance = activity.distance / 1609.34; // miles
  
  if (name.includes('race') || name.includes('5k') || name.includes('10k') || name.includes('half') || name.includes('marathon')) {
    return 'race';
  }
  if (name.includes('tempo') || name.includes('threshold')) {
    return 'tempo';
  }
  if (name.includes('interval') || name.includes('track') || name.includes('speed')) {
    return 'interval';
  }
  if (distance >= 10) {
    return 'long';
  }
  if (name.includes('recovery') || name.includes('easy')) {
    return 'recovery';
  }
  
  return 'easy';
}

