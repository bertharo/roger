import { NextRequest, NextResponse } from 'next/server';
import { generateTwelveWeekPlan } from '@/lib/planGenerator/twelveWeekPlan';
import { Run, Goal } from '@/lib/types';
import { getUserId } from '@/lib/auth/getSession';
import { logger } from '@/lib/utils/logger';
import { assessmentToRuns } from '@/lib/fitness/assessmentToRuns';
import { queryOne } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    
    if (!userId) {
      return Response.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const body = await request.json();
    const { runs: providedRuns, goal: providedGoal } = body;
    
    // Use provided runs or try to load from Strava or fitness assessment
    let runs: Run[] = [];
    let hasStravaData = false;
    let hasRealData = false;
    
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
          try {
            // Check if DATABASE_URL is configured before attempting query
            if (process.env.DATABASE_URL && userId) {
              logger.info('Checking for fitness assessment for 12-week plan, userId:', userId);
              try {
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
                  logger.info('Found fitness assessment for 12-week plan, converting to runs:', {
                    fitnessLevel: assessment.fitness_level,
                    weeklyMileage: assessment.weekly_mileage,
                    userId: userId,
                  });
                  const assessmentData = {
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
                  logger.info(`Using fitness assessment data for 12-week plan generation - generated ${runs.length} runs`);
                } else {
                  logger.warn('No fitness assessment found in database for 12-week plan, userId:', userId);
                }
              } catch (queryError: any) {
                logger.error('Database query error when checking fitness assessment:', {
                  error: queryError.message,
                  code: queryError.code,
                  userId: userId,
                });
                throw queryError; // Re-throw to be caught by outer catch
              }
            } else {
              logger.warn('Skipping fitness assessment check for 12-week plan - DATABASE_URL:', !!process.env.DATABASE_URL, 'userId:', userId);
            }
          } catch (dbError: any) {
            if (dbError.message?.includes('does not exist') || dbError.code === '42P01') {
              logger.warn('Fitness assessments table does not exist - database may need migration');
            } else {
              logger.error('Error loading fitness assessment for 12-week plan:', {
                error: dbError.message,
                code: dbError.code,
                stack: dbError.stack,
              });
            }
          }
        }
        
        // No mock data fallback - return error if no data
        if (!hasRealData && runs.length === 0) {
          logger.warn('No run data available for 12-week plan - no Strava connection or fitness assessment', {
            hasStravaData,
            userId,
            hasDatabaseUrl: !!process.env.DATABASE_URL,
          });
          return Response.json(
            { 
              error: 'No run data available. Please connect Strava or complete a fitness assessment.',
              debug: {
                hasStravaData,
                userId,
                hasDatabaseUrl: !!process.env.DATABASE_URL,
              }
            },
            { status: 400 }
          );
        }
      } catch (e) {
        logger.error('Error loading run data for 12-week plan:', e);
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
      logger.warn('Invalid or missing goal data for 12-week plan');
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
    
    const plans = generateTwelveWeekPlan(goal, recentRuns);
    
    return Response.json(plans);
      } catch (error) {
        logger.error('Error generating 12-week plan:', error);
    return Response.json(
      { error: 'Failed to generate 12-week plan' },
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
