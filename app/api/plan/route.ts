import { NextRequest } from 'next/server';
import { generateWeeklyPlan } from '@/lib/planGenerator';
import { castMockRuns } from '@/lib/utils/typeHelpers';
import mockData from '@/data/stravaMock.json';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic'; // Force dynamic rendering

export async function GET(request: NextRequest) {
  try {
    const weekStart = request.nextUrl.searchParams.get('weekStart');
    
    const runs = castMockRuns(mockData.runs);
    const goal = mockData.goal;
    
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
