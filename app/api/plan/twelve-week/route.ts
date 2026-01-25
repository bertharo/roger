import { NextRequest, NextResponse } from 'next/server';
import { generateTwelveWeekPlan } from '@/lib/planGenerator/twelveWeekPlan';
import { castMockRuns } from '@/lib/utils/typeHelpers';
import { Run, Goal } from '@/lib/types';
import { logger } from '@/lib/utils/logger';
import mockData from '@/data/stravaMock.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { runs: providedRuns, goal: providedGoal } = body;
    
    // Use provided runs or try to load from Strava
    let runs: Run[] = providedRuns || castMockRuns(mockData.runs);
    
    if (!providedRuns) {
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
            }
          }
        }
          } catch (e) {
            logger.error('Error loading Strava data:', e);
          }
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
