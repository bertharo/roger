import { Goal, Run, WeeklyPlan } from '../types';
import { generateWeeklyPlan } from './index';
import { inferPaceProfile } from './paceInference';

/**
 * Generate a 12-week training plan with progressive mileage
 */
export function generateTwelveWeekPlan(
  goal: Goal,
  recentRuns: Run[]
): WeeklyPlan[] {
  const plans: WeeklyPlan[] = [];
  const raceDate = new Date(goal.raceDate);
  raceDate.setHours(0, 0, 0, 0);
  
  // Calculate current weekly mileage from recent runs
  const recentWeeklyMiles = recentRuns.length > 0
    ? recentRuns
        .filter(run => {
          const runDate = new Date(run.date);
          const sevenDaysAgo = new Date();
          sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7);
          return runDate >= sevenDaysAgo;
        })
        .reduce((sum, run) => sum + run.distanceMiles, 0)
    : 15; // Default starting point if no recent runs
  
  // Calculate target peak weekly mileage based on goal distance
  // Half marathon: 35-45 miles, Marathon: 50-70 miles, 10K: 25-35 miles
  let peakWeeklyMiles: number;
  if (goal.distance >= 26) {
    peakWeeklyMiles = 55; // Marathon
  } else if (goal.distance >= 13) {
    peakWeeklyMiles = 40; // Half marathon
  } else if (goal.distance >= 6) {
    peakWeeklyMiles = 30; // 10K
  } else {
    peakWeeklyMiles = 25; // 5K
  }
  
  // Don't exceed current fitness by more than 20% in first week
  const startingMiles = Math.min(
    Math.max(recentWeeklyMiles * 1.1, 15), // At least 10% increase from current
    peakWeeklyMiles * 0.6 // But not more than 60% of peak
  );
  
  // Start 12 weeks before race
  const startDate = new Date(raceDate);
  startDate.setDate(startDate.getDate() - 12 * 7);
  startDate.setHours(0, 0, 0, 0);
  
  // Generate 12 weekly plans with progressive mileage
  for (let week = 0; week < 12; week++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() + week * 7);
    
    // Calculate target weekly mileage for this week
    // Build up over 8 weeks, then taper for 4 weeks
    let targetWeeklyMiles: number;
    if (week < 8) {
      // Build phase: linear progression from starting to peak
      const progress = week / 7; // 0 to 1 over 8 weeks
      targetWeeklyMiles = startingMiles + (peakWeeklyMiles - startingMiles) * progress;
    } else {
      // Taper phase: reduce mileage by 20%, 30%, 40%, 50% in last 4 weeks
      const taperWeek = week - 8; // 0, 1, 2, 3
      const taperPercent = [0.8, 0.7, 0.6, 0.5][taperWeek];
      targetWeeklyMiles = peakWeeklyMiles * taperPercent;
    }
    
    // Generate plan for this week with target mileage
    const plan = generateWeeklyPlanWithTarget(
      goal,
      recentRuns,
      weekStart.toISOString(),
      targetWeeklyMiles,
      week
    );
    plans.push(plan);
  }
  
  return plans;
}

/**
 * Generate a weekly plan with a target total mileage
 */
function generateWeeklyPlanWithTarget(
  goal: Goal,
  recentRuns: Run[],
  weekStartDate: string,
  targetWeeklyMiles: number,
  weekIndex: number
): WeeklyPlan {
  const startDate = new Date(weekStartDate);
  startDate.setHours(0, 0, 0, 0);
  
  // Calculate goal pace
  const goalPace = goal.targetTimeMinutes / goal.distance;
  
  // Get current pace profile from recent runs
  const currentPaceProfile = inferPaceProfile(recentRuns, goal);
  
  // Calculate current average pace from recent runs
  const currentAvgPace = recentRuns.length > 0
    ? recentRuns.slice(0, 5).reduce((sum, r) => sum + r.averagePaceMinPerMile, 0) / Math.min(5, recentRuns.length)
    : 8.0; // Default if no runs
  
  // Calculate pace gap (how much faster we need to get)
  const paceGap = currentAvgPace - goalPace;
  
  // Progress over 12 weeks: 0% at week 0, 100% at week 11 (race week)
  // But we don't want to hit goal pace until race week, so taper at 85-90%
  const progress = weekIndex < 8 
    ? weekIndex / 8 * 0.85  // Build phase: get to 85% of goal by week 8
    : 0.85 + (weekIndex - 8) / 4 * 0.1; // Taper: get to 95% by race week
  
  // Calculate target paces for this week
  // Easy pace: stays relatively stable, maybe gets slightly faster
  const targetEasyPace = currentPaceProfile.easyPaceRange[0] - (paceGap * 0.2 * progress);
  const easyPaceRange: [number, number] = [
    Math.max(goalPace + 2.0, Math.round(targetEasyPace * 10) / 10),
    Math.max(goalPace + 2.5, Math.round((targetEasyPace + 0.5) * 10) / 10),
  ];
  
  // Threshold pace: progressive toward goal pace
  // Threshold should be faster than goal pace (goal is race pace)
  const targetThreshold = currentPaceProfile.thresholdPace - (paceGap * 0.6 * progress);
  const thresholdPace = Math.max(goalPace + 0.2, Math.round(targetThreshold * 10) / 10);
  
  // Create progressive pace profile
  const progressivePaceProfile: typeof currentPaceProfile = {
    easyPaceRange,
    thresholdPace,
    fitnessTrend: currentPaceProfile.fitnessTrend,
  };
  
  // Calculate days until goal
  const raceDate = new Date(goal.raceDate);
  const daysToGoal = Math.ceil((raceDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Generate base plan with progressive paces
  const basePlan = generateWeeklyPlanWithPaces(goal, recentRuns, weekStartDate, progressivePaceProfile, daysToGoal);
  
  // Scale distances to match target weekly mileage
  const currentTotal = basePlan.days.reduce((sum, day) => sum + day.distanceMiles, 0);
  const scaleFactor = currentTotal > 0 ? targetWeeklyMiles / currentTotal : 1;
  
  // Adjust each day's distance
  const adjustedDays = basePlan.days.map(day => {
    if (day.runType === 'rest') {
      return day; // Don't scale rest days
    }
    
    // Scale the distance, but keep it reasonable
    const scaledDistance = Math.round(day.distanceMiles * scaleFactor * 10) / 10;
    
    // Ensure minimum distances for workout types
    let finalDistance = scaledDistance;
    if (day.runType === 'tempo' && finalDistance < 3.0) finalDistance = 3.0;
    if (day.runType === 'interval' && finalDistance < 2.5) finalDistance = 2.5;
    if (day.runType === 'long' && finalDistance < 6.0) finalDistance = 6.0;
    if (day.runType === 'easy' && finalDistance < 2.0) finalDistance = 2.0;
    
    // Cap maximum distances
    if (day.runType === 'long' && finalDistance > goal.distance * 0.9) {
      finalDistance = Math.round(goal.distance * 0.9 * 10) / 10;
    }
    if (day.runType !== 'long' && finalDistance > 8.0) {
      finalDistance = 8.0;
    }
    
    return {
      ...day,
      distanceMiles: finalDistance,
    };
  });
  
  // Recalculate total to ensure we hit target (within rounding)
  const adjustedTotal = adjustedDays.reduce((sum, day) => sum + day.distanceMiles, 0);
  const difference = targetWeeklyMiles - adjustedTotal;
  
  // Add difference to long run if positive, or subtract from easy runs if negative
  if (Math.abs(difference) > 0.5) {
    const longRunIndex = adjustedDays.findIndex(d => d.runType === 'long');
    if (longRunIndex >= 0 && difference > 0) {
      adjustedDays[longRunIndex].distanceMiles = Math.round((adjustedDays[longRunIndex].distanceMiles + difference) * 10) / 10;
    } else if (difference < 0) {
      // Distribute reduction across easy runs
      const easyRuns = adjustedDays.filter(d => d.runType === 'easy');
      const reductionPerRun = Math.abs(difference) / easyRuns.length;
      easyRuns.forEach(easyRun => {
        const index = adjustedDays.indexOf(easyRun);
        adjustedDays[index].distanceMiles = Math.max(2.0, Math.round((easyRun.distanceMiles - reductionPerRun) * 10) / 10);
      });
    }
  }
  
  const finalTotal = adjustedDays.reduce((sum, day) => sum + day.distanceMiles, 0);
  
  return {
    weekStartDate: startDate.toISOString(),
    days: adjustedDays,
    totalMiles: Math.round(finalTotal * 10) / 10,
  };
}


/**
 * Calculate total miles for a week
 */
export function getWeekTotalMiles(plan: WeeklyPlan): number {
  return plan.days.reduce((sum, day) => sum + day.distanceMiles, 0);
}
