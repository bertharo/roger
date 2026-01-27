import { Run, Goal, WeeklyPlan, WeeklyPlanDay, PaceProfile, FitnessAssessment } from '../types';
import { inferPaceProfile } from './paceInference';

/**
 * Generate a weekly training plan based on goal and recent runs.
 * This is the SINGLE SOURCE OF TRUTH for plan generation.
 * 
 * @param goal - Race goal (date, distance, target time)
 * @param recentRuns - Recent run history (can be empty if using assessment)
 * @param weekStartDate - Optional week start date (defaults to today)
 * @param assessment - Optional fitness assessment (used when no recent runs)
 * @param targetWeeklyMiles - Optional target weekly mileage (for progressive plans)
 */
export function generateWeeklyPlan(
  goal: Goal,
  recentRuns: Run[],
  weekStartDate?: string,
  assessment?: FitnessAssessment,
  targetWeeklyMiles?: number
): WeeklyPlan {
  // Use provided week start or default to today
  const startDate = weekStartDate 
    ? new Date(weekStartDate)
    : new Date();
  startDate.setHours(0, 0, 0, 0);
  
  // Get pace profile from recent runs or assessment (with goal consideration)
  const paceProfile = inferPaceProfile(recentRuns, goal, assessment);
  
  // Calculate days until goal
  const raceDate = new Date(goal.raceDate);
  const daysToGoal = Math.ceil((raceDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  return generateWeeklyPlanWithPaces(
    goal, 
    recentRuns, 
    weekStartDate, 
    paceProfile, 
    daysToGoal,
    assessment,
    targetWeeklyMiles
  );
}

/**
 * Generate weekly plan with specific pace profile
 * Exported for use in 12-week plan generation
 */
export function generateWeeklyPlanWithPaces(
  goal: Goal,
  recentRuns: Run[],
  weekStartDate: string | undefined,
  paceProfile: PaceProfile,
  daysToGoal: number,
  assessment?: FitnessAssessment,
  targetWeeklyMiles?: number
): WeeklyPlan {
  const startDate = weekStartDate 
    ? new Date(weekStartDate)
    : new Date();
  startDate.setHours(0, 0, 0, 0);
  
  // Ensure week starts on Monday
  const day = startDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  startDate.setDate(diff);
  
  // Determine days per week from assessment or default to 5
  const daysPerWeek = assessment?.daysPerWeek || 5;
  
  // Generate 7 days (Monday through Sunday)
  const days: WeeklyPlanDay[] = [];
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  // Generate base plan structure respecting daysPerWeek
  const baseDays = generateWeeklyStructure(
    startDate,
    dayNames,
    goal,
    paceProfile,
    daysToGoal,
    recentRuns.length,
    daysPerWeek,
    assessment
  );
  
  // If target weekly miles specified, scale to match
  if (targetWeeklyMiles) {
    const currentTotal = baseDays.reduce((sum, day) => sum + day.distanceMiles, 0);
    if (currentTotal > 0) {
      const scaleFactor = targetWeeklyMiles / currentTotal;
      const scaledDays = baseDays.map(day => {
        if (day.runType === 'rest') return day;
        const scaled = Math.round(day.distanceMiles * scaleFactor * 10) / 10;
        return { ...day, distanceMiles: scaled };
      });
      
      // Ensure minimums and adjust to hit target
      const adjustedDays = adjustDistancesToTarget(scaledDays, targetWeeklyMiles, goal);
      days.push(...adjustedDays);
    } else {
      days.push(...baseDays);
    }
  } else {
    days.push(...baseDays);
  }
  
  const totalMiles = days.reduce((sum, day) => sum + day.distanceMiles, 0);
  
  return {
    weekStartDate: startDate.toISOString(),
    days,
    totalMiles: Math.round(totalMiles * 10) / 10,
  };
}

/**
 * Generate weekly structure respecting daysPerWeek from assessment
 */
function generateWeeklyStructure(
  startDate: Date,
  dayNames: string[],
  goal: Goal,
  paceProfile: PaceProfile,
  daysToGoal: number,
  recentRunCount: number,
  daysPerWeek: number,
  assessment?: FitnessAssessment
): WeeklyPlanDay[] {
  const days: WeeklyPlanDay[] = [];
  const goalPace = goal.targetTimeMinutes / goal.distance;
  
  // Determine workout distribution based on fitness level
  const fitnessLevel = assessment?.fitnessLevel || 'intermediate';
  let tempoCount: number;
  let intervalCount: number;
  
  if (fitnessLevel === 'beginner') {
    tempoCount = Math.max(1, Math.floor(daysPerWeek * 0.15));
    intervalCount = Math.max(0, Math.floor(daysPerWeek * 0.05));
  } else if (fitnessLevel === 'intermediate') {
    tempoCount = Math.max(1, Math.floor(daysPerWeek * 0.20));
    intervalCount = Math.max(0, Math.floor(daysPerWeek * 0.10));
  } else { // advanced
    tempoCount = Math.max(1, Math.floor(daysPerWeek * 0.20));
    intervalCount = Math.max(1, Math.floor(daysPerWeek * 0.15));
  }
  
  // Always include 1 long run
  const easyCount = daysPerWeek - tempoCount - intervalCount - 1; // -1 for long run
  const restCount = 7 - daysPerWeek;
  
  // Determine workout placement based on days to goal
  const useIntervals = daysToGoal <= 21; // Use intervals when closer to race
  
  // Build workout schedule
  const workouts: Array<{ type: 'easy' | 'tempo' | 'interval' | 'long' | 'rest', dayIndex: number }> = [];
  
  // Place long run on Saturday (day 5)
  workouts.push({ type: 'long', dayIndex: 5 });
  
  // Place tempo/intervals on Tuesday/Thursday (days 1, 3)
  if (useIntervals && intervalCount > 0) {
    workouts.push({ type: 'interval', dayIndex: 1 });
    if (intervalCount > 1 && daysPerWeek >= 6) {
      workouts.push({ type: 'interval', dayIndex: 3 });
    }
  } else {
    workouts.push({ type: 'tempo', dayIndex: 1 });
    if (tempoCount > 1 && daysPerWeek >= 5) {
      workouts.push({ type: 'tempo', dayIndex: 3 });
    }
  }
  
  // Fill remaining days with easy runs
  const easyDays = [0, 2, 4, 6].filter(i => !workouts.some(w => w.dayIndex === i));
  for (let i = 0; i < easyCount && i < easyDays.length; i++) {
    workouts.push({ type: 'easy', dayIndex: easyDays[i] });
  }
  
  // Fill rest with rest days
  const usedDays = new Set(workouts.map(w => w.dayIndex));
  for (let i = 0; i < 7; i++) {
    if (!usedDays.has(i)) {
      workouts.push({ type: 'rest', dayIndex: i });
    }
  }
  
  // Sort by day index
  workouts.sort((a, b) => a.dayIndex - b.dayIndex);
  
  // Generate day plans
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    const dayOfWeek = dayNames[i];
    const workout = workouts.find(w => w.dayIndex === i) || { type: 'rest' as const, dayIndex: i };
    
    const dayPlan = generateDayPlan(
      i,
      dayOfWeek,
      currentDate.toISOString(),
      goal,
      paceProfile,
      daysToGoal,
      workout.type,
      goalPace,
      assessment
    );
    
    days.push(dayPlan);
  }
  
  return days;
}

/**
 * Generate a single day's plan
 */
function generateDayPlan(
  dayIndex: number,
  dayOfWeek: string,
  date: string,
  goal: Goal,
  paceProfile: PaceProfile,
  daysToGoal: number,
  runType: 'easy' | 'tempo' | 'interval' | 'long' | 'rest',
  goalPace: number,
  assessment?: FitnessAssessment
): WeeklyPlanDay {
  const fitnessLevel = assessment?.fitnessLevel || 'intermediate';
  const weeklyMileage = assessment?.weeklyMileage || 20;
  const avgMilesPerRun = weeklyMileage / (assessment?.daysPerWeek || 5);
  
  if (runType === 'rest') {
    return {
      date,
      dayOfWeek,
      runType: 'rest',
      distanceMiles: 0,
      paceRangeMinPerMile: [0, 0],
      coachingIntent: 'Rest day to allow recovery and adaptation.',
    };
  }
  
  if (runType === 'easy') {
    // Use day index to create variation without randomness
    const variation = 0.8 + (dayIndex % 3) * 0.1; // 0.8, 0.9, 1.0, 0.8, ...
    const distance = Math.max(2.0, Math.round(avgMilesPerRun * variation * 10) / 10);
    return {
      date,
      dayOfWeek,
      runType: 'easy',
      distanceMiles: Math.min(8.0, distance),
      paceRangeMinPerMile: paceProfile.easyPaceRange,
      coachingIntent: 'Easy run to build aerobic base. Keep it conversational.',
    };
  }
  
  if (runType === 'tempo') {
    const distance = Math.max(3.0, Math.round(avgMilesPerRun * 0.9 * 10) / 10);
    const thresholdPace = paceProfile.thresholdPace;
    return {
      date,
      dayOfWeek,
      runType: 'tempo',
      distanceMiles: Math.min(8.0, distance),
      paceRangeMinPerMile: [
        Math.round((thresholdPace - 0.2) * 10) / 10,
        Math.round((thresholdPace + 0.2) * 10) / 10,
      ],
      coachingIntent: `Tempo run at threshold pace (${thresholdPace.toFixed(1)} min/mi). Comfortably hard effort.`,
    };
  }
  
  if (runType === 'interval') {
    const distance = Math.max(2.5, Math.round(avgMilesPerRun * 0.7 * 10) / 10);
    const intervalPace = Math.max(goalPace - 0.3, paceProfile.thresholdPace - 0.5);
    return {
      date,
      dayOfWeek,
      runType: 'interval',
      distanceMiles: Math.min(6.0, distance),
      paceRangeMinPerMile: [
        Math.round((intervalPace - 0.2) * 10) / 10,
        Math.round((intervalPace + 0.2) * 10) / 10,
      ],
      coachingIntent: `Interval workout at ${intervalPace.toFixed(1)} min/mi to sharpen speed. Include warm-up and cool-down.`,
    };
  }
  
  if (runType === 'long') {
    // Long run: 20-35% of weekly mileage, max based on goal distance
    const weeklyMiles = assessment?.weeklyMileage || 20;
    const longRunPercent = fitnessLevel === 'beginner' ? 0.25 : fitnessLevel === 'intermediate' ? 0.30 : 0.35;
    let longRunDistance = Math.round(weeklyMiles * longRunPercent * 10) / 10;
    
    // Cap based on goal distance and taper
    const maxLongRun = goal.distance >= 26 ? 22 : goal.distance >= 13 ? 20 : goal.distance * 0.9;
    longRunDistance = Math.min(longRunDistance, maxLongRun);
    
    // Taper in final 2 weeks
    if (daysToGoal <= 14) {
      longRunDistance = Math.round(longRunDistance * 0.7 * 10) / 10;
    }
    if (daysToGoal <= 7) {
      longRunDistance = Math.round(longRunDistance * 0.5 * 10) / 10;
    }
    
    // Minimum long run distance
    longRunDistance = Math.max(6.0, longRunDistance);
    
    return {
      date,
      dayOfWeek,
      runType: 'long',
      distanceMiles: longRunDistance,
      paceRangeMinPerMile: [
        Math.round((paceProfile.easyPaceRange[0] + 0.5) * 10) / 10,
        Math.round((paceProfile.easyPaceRange[1] + 0.5) * 10) / 10,
      ],
      coachingIntent: `Long run to build endurance. Run at easy pace, focus on time on feet.`,
    };
  }
  
  // Fallback
  return {
    date,
    dayOfWeek,
    runType: 'rest',
    distanceMiles: 0,
    paceRangeMinPerMile: [0, 0],
    coachingIntent: 'Rest day.',
  };
}

/**
 * Adjust distances to hit target weekly mileage
 */
function adjustDistancesToTarget(
  days: WeeklyPlanDay[],
  targetWeeklyMiles: number,
  goal: Goal
): WeeklyPlanDay[] {
  const currentTotal = days.reduce((sum, day) => sum + day.distanceMiles, 0);
  const difference = targetWeeklyMiles - currentTotal;
  
  if (Math.abs(difference) < 0.5) {
    return days; // Close enough
  }
  
  const adjusted = [...days];
  
  if (difference > 0) {
    // Add to long run first, then easy runs
    const longRunIndex = adjusted.findIndex(d => d.runType === 'long');
    if (longRunIndex >= 0) {
      const maxLongRun = goal.distance >= 26 ? 22 : goal.distance >= 13 ? 20 : goal.distance * 0.9;
      const currentLong = adjusted[longRunIndex].distanceMiles;
      const addToLong = Math.min(difference * 0.6, maxLongRun - currentLong);
      adjusted[longRunIndex].distanceMiles = Math.round((currentLong + addToLong) * 10) / 10;
      
      const remaining = difference - addToLong;
      if (remaining > 0) {
        // Distribute to easy runs
        const easyRuns = adjusted.filter(d => d.runType === 'easy');
        const addPerEasy = remaining / easyRuns.length;
        easyRuns.forEach(easyRun => {
          const index = adjusted.indexOf(easyRun);
          adjusted[index].distanceMiles = Math.min(8.0, Math.round((easyRun.distanceMiles + addPerEasy) * 10) / 10);
        });
      }
    }
  } else {
    // Subtract from easy runs first
    const easyRuns = adjusted.filter(d => d.runType === 'easy');
    const subtractPerEasy = Math.abs(difference) / easyRuns.length;
    easyRuns.forEach(easyRun => {
      const index = adjusted.indexOf(easyRun);
      adjusted[index].distanceMiles = Math.max(2.0, Math.round((easyRun.distanceMiles - subtractPerEasy) * 10) / 10);
    });
  }
  
  return adjusted;
}
