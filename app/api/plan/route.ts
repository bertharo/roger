import { NextRequest } from 'next/server';
import { generateWeeklyPlan } from '@/lib/planGenerator';
import { castMockRuns } from '@/lib/utils/typeHelpers';
import { Run, Goal } from '@/lib/types';
import { getUserId } from '@/lib/auth/getSession';
import { checkPlanRateLimit, incrementPlanUsage } from '@/lib/rateLimit';
import { checkGlobalCostLimit } from '@/lib/rateLimit';
import mockData from '@/data/stravaMock.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Force dynamic rendering

export async function GET(request: NextRequest) {
  try {
    const weekStart = request.nextUrl.searchParams.get('weekStart');
    
    // Try to load Strava data first
    let runs: Run[] = castMockRuns(mockData.runs);
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
      console.error('Error loading Strava data:', e);
      // Use mock data as fallback
    }
    
    // Try to load goal from API, fallback to mock data
    let goal: Goal = mockData.goal;
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
    
    // Get most recent 5 runs for pace inference
    const sortedRuns = [...runs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const recentRuns = sortedRuns.slice(0, 5);
    
    const plan = generateWeeklyPlan(goal, recentRuns, weekStart || undefined);
    
    return Response.json(plan);
  } catch (error) {
    console.error('Error generating plan:', error);
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
        console.error('Error loading Strava data:', e);
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
    
    const plan = generateWeeklyPlan(goal, recentRuns, weekStart || undefined);
    
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
    console.error('Error generating plan:', error);
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

