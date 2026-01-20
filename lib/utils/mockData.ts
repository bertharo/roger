import { WeeklyPlan, RecentRun, Goal } from '@/lib/types/dashboard';
import { getDayLabel } from './formatting';

/**
 * Transform the existing plan format to the new dashboard format
 */
export function transformPlanToDashboardFormat(plan: any): WeeklyPlan | null {
  if (!plan || !plan.days) return null;

  const runTypeMap: Record<string, 'easy' | 'workout' | 'long' | 'rest'> = {
    easy: 'easy',
    recovery: 'easy',
    tempo: 'workout',
    interval: 'workout',
    long: 'long',
    rest: 'rest',
  };

  const days = plan.days.map((day: any) => {
    const runType = runTypeMap[day.runType] || 'easy';
    
    // Generate structure based on run type
    let structure: string[] = [];
    if (runType === 'workout') {
      structure = [
        '10 min easy warm-up',
        'Main set: 4x1 mile @ threshold pace with 2 min recovery',
        '10 min easy cool-down',
      ];
    } else if (runType === 'long') {
      structure = [
        'Start easy, build to steady pace',
        'Focus on time on feet and fueling',
        'Finish strong but controlled',
      ];
    } else if (runType === 'easy') {
      structure = [
        'Conversational pace throughout',
        'Focus on form and relaxation',
      ];
    }

    return {
      dateISO: day.date,
      dayLabel: day.dayOfWeek.substring(0, 3),
      runType,
      title: day.runType === 'tempo' ? 'Tempo' : 
             day.runType === 'interval' ? 'Intervals' :
             day.runType === 'long' ? 'Long Run' :
             day.runType === 'rest' ? 'Rest' : 'Easy',
      distanceMi: day.distanceMiles || null,
      paceRangeMinPerMi: day.paceRangeMinPerMile && day.paceRangeMinPerMile[0] > 0 
        ? day.paceRangeMinPerMile as [number, number]
        : undefined,
      purpose: day.coachingIntent || 'Build aerobic fitness.',
      structure,
      notes: day.runType === 'long' ? 'Consider bringing hydration and fuel.' : undefined,
    };
  });

  return {
    weekStartISO: plan.weekStartDate,
    totalMilesPlanned: plan.totalMiles || 0,
    days,
  };
}

/**
 * Transform recent run to dashboard format
 */
export function transformRecentRun(runs: any[]): RecentRun | null {
  if (!runs || runs.length === 0) return null;

  const sortedRuns = [...runs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  const mostRecent = sortedRuns[0];

  const titleMap: Record<string, string> = {
    easy: 'Easy Run',
    recovery: 'Recovery Run',
    tempo: 'Tempo Run',
    interval: 'Interval Workout',
    long: 'Long Run',
    race: 'Race',
  };

  return {
    dateISO: mostRecent.date,
    distanceMi: mostRecent.distanceMiles,
    avgPaceMinPerMi: mostRecent.averagePaceMinPerMile,
    title: titleMap[mostRecent.type] || 'Run',
  };
}

/**
 * Transform goal to dashboard format
 */
export function transformGoal(goal: any): Goal | null {
  if (!goal) return null;

  // Determine race name based on distance
  let raceName = '';
  if (goal.distance === 13.1) {
    raceName = 'Half Marathon';
  } else if (goal.distance === 26.2) {
    raceName = 'Marathon';
  } else if (goal.distance === 6.2) {
    raceName = '10K';
  } else if (goal.distance === 3.1) {
    raceName = '5K';
  } else {
    raceName = `${goal.distance} mi race`;
  }

  return {
    raceName,
    raceDateISO: goal.raceDate,
    distanceMi: goal.distance,
    targetTimeMinutes: goal.targetTimeMinutes,
  };
}

/**
 * Transform dashboard format plan back to core format
 */
export function transformPlanToCoreFormat(dashboardPlan: any): any {
  if (!dashboardPlan || !dashboardPlan.days) return null;

  const runTypeMap: Record<string, 'easy' | 'tempo' | 'interval' | 'long' | 'rest'> = {
    easy: 'easy',
    workout: 'tempo', // Default workout to tempo
    long: 'long',
    rest: 'rest',
  };

  const days = dashboardPlan.days.map((day: any) => {
    // Map dashboard runType back to core runType
    const coreRunType = runTypeMap[day.runType] || 'easy';
    
    return {
      date: day.dateISO,
      dayOfWeek: day.dayLabel ? 
        ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].includes(day.dayLabel) ?
          ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'][
            ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'].indexOf(day.dayLabel)
          ] : day.dayLabel
        : new Date(day.dateISO).toLocaleDateString('en-US', { weekday: 'long' }),
      runType: coreRunType,
      distanceMiles: day.distanceMi || 0,
      paceRangeMinPerMile: day.paceRangeMinPerMi || [8.0, 9.0],
      coachingIntent: day.purpose || 'Build aerobic fitness.',
    };
  });

  return {
    weekStartDate: dashboardPlan.weekStartISO,
    days,
    totalMiles: dashboardPlan.totalMilesPlanned || 0,
  };
}
