import { NextRequest } from 'next/server';
import { generateCoachChatResponse } from '@/lib/coachChat';
import { generateWeeklyPlan } from '@/lib/planGenerator';
import { castMockRuns } from '@/lib/utils/typeHelpers';
import { WeeklyPlanDay } from '@/lib/types';
import mockData from '@/data/stravaMock.json';

export const runtime = 'nodejs';

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { message, currentPlan, chatHistory } = body;
    
    const runs = castMockRuns(mockData.runs);
    const goal = mockData.goal;
    
    // Get most recent 5 runs
    const sortedRuns = [...runs].sort(
      (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
    );
    const recentRuns = sortedRuns.slice(0, 5);
    
    // Use provided plan or generate new one
    const plan = currentPlan || generateWeeklyPlan(goal, recentRuns);
    
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
  } catch (error) {
    console.error('Error in chat API:', error);
    return Response.json(
      { error: 'Failed to generate coach response' },
      { status: 500 }
    );
  }
}
