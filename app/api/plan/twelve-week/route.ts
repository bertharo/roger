import { NextRequest, NextResponse } from 'next/server';
import { generateTwelveWeekPlan } from '@/lib/planGenerator/twelveWeekPlan';
import { castMockRuns } from '@/lib/utils/typeHelpers';
import { Run, Goal } from '@/lib/types';
import { getUserId } from '@/lib/auth/getSession';
import { logger } from '@/lib/utils/logger';
import { assessmentToRuns } from '@/lib/fitness/assessmentToRuns';
import { queryOne } from '@/lib/db/client';
import mockData from '@/data/stravaMock.json';

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
    
    // Check if provided runs are mock data by comparing IDs with known mock data IDs
    const mockRuns = castMockRuns(mockData.runs);
    const mockRunIds = new Set(mockRuns.map((r: Run) => r.id));
    const isMockData = providedRuns && providedRuns.length > 0 && 
      providedRuns.every((r: Run) => mockRunIds.has(r.id));
    
    // If no runs provided or runs are mock data, try to load real data
    if (!providedRuns || providedRuns.length === 0 || isMockData) {
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
                logger.info('Using fitness assessment data for 12-week plan generation');
              }
            }
          } catch (dbError: any) {
            if (dbError.message?.includes('does not exist') || dbError.code === '42P01') {
              logger.debug('Fitness assessments table does not exist');
            } else {
              logger.error('Error loading fitness assessment:', dbError);
            }
          }
        }
        
        // Final fallback to mock data only if we have no real data
        if (!hasRealData && runs.length === 0) {
          runs = castMockRuns(mockData.runs);
        }
      } catch (e) {
        logger.error('Error loading run data:', e);
        if (!hasRealData) {
          runs = castMockRuns(mockData.runs);
        }
      }
    } else {
      // Provided runs are real data (not mock)
      hasRealData = true;
      runs = providedRuns;
    }
    
    // Use provided goal or load from cookies
    let goal: Goal = providedGoal || mockData.goal;
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
