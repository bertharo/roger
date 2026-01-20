import { Run, Goal } from '../types';

/**
 * Calculate weekly mileage for the last N days
 */
export function getWeeklyMiles(runs: Run[], days: number = 7): number {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  return runs
    .filter(run => new Date(run.date) >= cutoffDate)
    .reduce((sum, run) => sum + run.distanceMiles, 0);
}

/**
 * Get recent pace distribution by run type
 */
export function getRecentPaceDistribution(runs: Run[], days: number = 14): {
  easy: number[];
  tempo: number[];
  interval: number[];
  long: number[];
  all: number[];
} {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const recentRuns = runs.filter(run => new Date(run.date) >= cutoffDate);
  
  const distribution = {
    easy: [] as number[],
    tempo: [] as number[],
    interval: [] as number[],
    long: [] as number[],
    all: [] as number[],
  };
  
  recentRuns.forEach(run => {
    distribution.all.push(run.averagePaceMinPerMile);
    if (run.type === 'easy' || run.type === 'recovery') {
      distribution.easy.push(run.averagePaceMinPerMile);
    } else if (run.type === 'tempo') {
      distribution.tempo.push(run.averagePaceMinPerMile);
    } else if (run.type === 'interval') {
      distribution.interval.push(run.averagePaceMinPerMile);
    } else if (run.type === 'long') {
      distribution.long.push(run.averagePaceMinPerMile);
    }
  });
  
  return distribution;
}

/**
 * Calculate training load trend (simple: compare last 7d vs previous 7d)
 */
export function getTrainingLoadTrend(runs: Run[]): {
  trend: 'increasing' | 'decreasing' | 'stable';
  last7d: number;
  previous7d: number;
} {
  const last7d = getWeeklyMiles(runs, 7);
  const previous7d = getWeeklyMiles(
    runs.filter(run => {
      const runDate = new Date(run.date);
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 7);
      return runDate < cutoff;
    }),
    7
  );
  
  const diff = last7d - previous7d;
  const threshold = 2; // miles
  
  let trend: 'increasing' | 'decreasing' | 'stable' = 'stable';
  if (diff > threshold) {
    trend = 'increasing';
  } else if (diff < -threshold) {
    trend = 'decreasing';
  }
  
  return { trend, last7d, previous7d };
}

/**
 * Calculate days until goal race
 */
export function getDaysToGoal(goal: Goal): number {
  const raceDate = new Date(goal.raceDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  raceDate.setHours(0, 0, 0, 0);
  
  const diffTime = raceDate.getTime() - today.getTime();
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  return Math.max(0, diffDays);
}

/**
 * Get average pace for a specific run type from recent runs
 */
export function getAveragePaceForType(
  runs: Run[],
  type: Run['type'],
  days: number = 14
): number | null {
  const cutoffDate = new Date();
  cutoffDate.setDate(cutoffDate.getDate() - days);
  
  const relevantRuns = runs.filter(run => {
    if (type === 'easy') {
      return (run.type === 'easy' || run.type === 'recovery') && new Date(run.date) >= cutoffDate;
    }
    return run.type === type && new Date(run.date) >= cutoffDate;
  });
  
  if (relevantRuns.length === 0) {
    return null;
  }
  
  const sum = relevantRuns.reduce((acc, run) => acc + run.averagePaceMinPerMile, 0);
  return sum / relevantRuns.length;
}

/**
 * Get most recent run
 */
export function getMostRecentRun(runs: Run[]): Run | null {
  if (runs.length === 0) return null;
  
  return runs.reduce((latest, run) => {
    return new Date(run.date) > new Date(latest.date) ? run : latest;
  });
}
