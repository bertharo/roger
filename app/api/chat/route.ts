import { NextRequest } from 'next/server';
import { generateCoachChatResponse } from '@/lib/coachChat';
import { generateWeeklyPlan } from '@/lib/planGenerator';
import { castMockRuns } from '@/lib/utils/typeHelpers';
import { transformPlanToCoreFormat } from '@/lib/utils/mockData';
import { WeeklyPlanDay } from '@/lib/types';
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
    const body = await request.json();
    const { message, currentPlan, chatHistory } = body;
    
    if (!message || typeof message !== 'string') {
      return Response.json(
        { error: 'Message is required' },
        { status: 400 }
      );
    }
    
    // Try to load Strava data first, fallback to mock data
    let runs = castMockRuns(mockData.runs);
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
    
    // Handle goal format conversion (dashboard format -> core format)
    let goal: any = mockData.goal;
    if (body.goal) {
      // If goal comes from frontend in dashboard format, convert it
      if (body.goal.raceDateISO) {
        goal = {
          raceDate: body.goal.raceDateISO,
          distance: body.goal.distanceMi,
          targetTimeMinutes: body.goal.targetTimeMinutes,
        };
      } else {
        goal = body.goal;
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
    
    const response = await generateCoachChatResponse(message, {
      currentPlan: plan,
      goal,
      recentRuns,
      chatHistory: chatHistory || [],
    });
    
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
    
    return Response.json({
      assistantMessage: response.assistantMessage,
      updatedPlan: modifiedPlan,
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
