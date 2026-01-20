import { Goal, Run, StatusBarKPIs } from '../types';

/**
 * Calculate status bar KPIs for the sticky header
 */
export function calculateStatusBarKPIs(goal: Goal, recentRuns: Run[]): StatusBarKPIs & { predictedTimeMinutes: number } {
  const raceDate = new Date(goal.raceDate);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  raceDate.setHours(0, 0, 0, 0);
  
  const daysToGoal = Math.max(0, Math.ceil((raceDate.getTime() - today.getTime()) / (1000 * 60 * 60 * 24)));
  
  // Estimate finish time based on recent runs and goal
  let predictedTimeMinutes = goal.targetTimeMinutes;
  let confidence: 'low' | 'medium' | 'high' = 'medium';
  
  if (recentRuns.length >= 3) {
    // Use recent long runs or tempo runs to estimate
    const relevantRuns = recentRuns.filter(
      r => r.type === 'long' || r.type === 'tempo' || r.distanceMiles >= goal.distance * 0.5
    );
    
    if (relevantRuns.length > 0) {
      const avgPace = relevantRuns.reduce((sum, r) => sum + r.averagePaceMinPerMile, 0) / relevantRuns.length;
      predictedTimeMinutes = avgPace * goal.distance;
      confidence = relevantRuns.length >= 3 ? 'high' : 'medium';
    } else {
      confidence = 'low';
    }
  } else {
    confidence = 'low';
  }
  
  // Format estimated time
  const hours = Math.floor(predictedTimeMinutes / 60);
  const minutes = Math.round(predictedTimeMinutes % 60);
  const estimatedFinishTime = hours > 0 
    ? `${hours}h ${minutes}m`
    : `${minutes}m`;
  
  return {
    daysToGoal,
    estimatedFinishTime,
    confidence,
    predictedTimeMinutes, // Include for backward compatibility
  };
}
