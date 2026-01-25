import { NextRequest } from 'next/server';
import { generateCoachChatResponse } from '@/lib/coachChat';
import { generateWeeklyPlan } from '@/lib/planGenerator';
import { castMockRuns } from '@/lib/utils/typeHelpers';
import { transformPlanToCoreFormat } from '@/lib/utils/mockData';
import { WeeklyPlanDay } from '@/lib/types';
import { getUserId } from '@/lib/auth/getSession';
import { checkChatRateLimit, incrementChatUsage } from '@/lib/rateLimit';
import { trackUsage } from '@/lib/costTracking';
import { checkGlobalCostLimit } from '@/lib/rateLimit';
import mockData from '@/data/stravaMock.json';

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

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Force dynamic rendering

export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    
    if (!userId) {
      return Response.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Check global cost limit
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
    
    // Check user rate limit
    const rateLimit = await checkChatRateLimit(userId);
    if (!rateLimit.allowed) {
      return Response.json(
        {
          error: `Daily limit reached. You've used ${rateLimit.limit} messages today. Your limit resets at ${rateLimit.resetAt.toLocaleTimeString()}.`,
          errorType: 'rate_limit_exceeded',
          remaining: rateLimit.remaining,
          resetAt: rateLimit.resetAt.toISOString(),
        },
        { status: 429 }
      );
    }
    
    const body = await request.json();
    const { message, currentPlan, chatHistory, runs: frontendRuns, goal: frontendGoal } = body;
    
    if (!message || typeof message !== 'string') {
      return Response.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    // Use provided runs or try to load Strava data, fallback to mock data
    let runs = frontendRuns || castMockRuns(mockData.runs);
    if (!frontendRuns) {
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
        console.error('Error loading Strava data in chat:', e);
        // Use mock data as fallback
      }
    }
    
    // Handle goal format conversion (dashboard format -> core format)
    let goal: any = mockData.goal;
    if (frontendGoal) {
      // If goal comes from frontend in dashboard format, convert it
      if (frontendGoal.raceDateISO) {
        goal = {
          raceDate: frontendGoal.raceDateISO,
          distance: frontendGoal.distanceMi,
          targetTimeMinutes: frontendGoal.targetTimeMinutes,
        };
      } else {
        goal = frontendGoal;
      }
    }
    
    // Get most recent 5 runs
    const sortedRuns = [...runs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const recentRuns = sortedRuns.slice(0, 5);
    
    // Transform dashboard format plan to core format if provided
    // Otherwise generate new one
    let plan;
    if (currentPlan) {
      plan = transformPlanToCoreFormat(currentPlan);
      if (!plan) {
        // Fallback to generating if transformation fails
        console.warn('Plan transformation failed, generating new plan');
        plan = generateWeeklyPlan(goal, recentRuns);
      }
    } else {
      plan = generateWeeklyPlan(goal, recentRuns);
    }
    
    // Validate plan has days
    if (!plan || !plan.days || plan.days.length === 0) {
      console.error('Invalid plan generated:', plan);
      return Response.json(
        { error: 'Failed to generate training plan. Please try again.' },
        { status: 500 }
      );
    }
    
    const response = await generateCoachChatResponse(message, {
      currentPlan: plan,
      goal,
      recentRuns,
      chatHistory: chatHistory || [],
    });
    
    // Track usage and cost (non-blocking - errors are handled internally)
    if (response.tokenUsage) {
      await trackUsage(
        userId,
        'chat',
        response.tokenUsage.inputTokens,
        response.tokenUsage.outputTokens
      ).catch(err => console.error('Failed to track usage (non-critical):', err));
    }
    await incrementChatUsage(userId).catch(err => console.error('Failed to increment usage (non-critical):', err));
    
    // Apply modifications to plan if any
    let modifiedPlan = plan;
    if (response.planModifications && response.planModifications.length > 0) {
      modifiedPlan = {
        ...plan,
        days: plan.days.map((day: WeeklyPlanDay, idx: number) => {
          const mod = response.planModifications!.find(m => m.dayIndex === idx);
          if (mod) {
            return { ...day, ...mod.changes };
          }
          return day;
        }),
      };
      // Recalculate total miles
      modifiedPlan.totalMiles = Math.round(
        modifiedPlan.days.reduce((sum: number, day: WeeklyPlanDay) => sum + day.distanceMiles, 0) * 10
      ) / 10;
    }
    
    // Get updated rate limit info (with error handling)
    let updatedRateLimit;
    try {
      updatedRateLimit = await checkChatRateLimit(userId);
    } catch (error) {
      console.error('Error getting updated rate limit, using previous:', error);
      updatedRateLimit = rateLimit; // Fallback to previous rate limit
    }
    
    return Response.json({
      assistantMessage: response.assistantMessage,
      updatedPlan: modifiedPlan,
      usage: {
        remaining: updatedRateLimit.remaining,
        limit: updatedRateLimit.limit,
        resetAt: updatedRateLimit.resetAt.toISOString(),
      },
    });
  } catch (error: any) {
    console.error('Error in chat API:', error);
    
    // Handle OpenAI quota/rate limit errors
    if (error?.status === 429 || error?.code === 'insufficient_quota') {
      return Response.json(
        { 
          error: 'OpenAI API quota exceeded. Please check your OpenAI account billing and plan.',
          errorType: 'quota_exceeded',
        },
        { status: 429 }
      );
    }
    
    // Handle other OpenAI errors
    if (error?.status) {
      return Response.json(
        { 
          error: error.message || 'Failed to generate coach response',
          errorType: 'api_error',
        },
        { status: error.status }
      );
    }
    
    const errorMessage = error instanceof Error ? error.message : 'Unknown error';
    return Response.json(
      { 
        error: 'Failed to generate coach response',
        errorType: 'unknown',
        details: process.env.NODE_ENV === 'development' ? errorMessage : undefined,
      },
      { status: 500 }
    );
  }
}
