import { Run, Goal, WeeklyPlan, WeeklyPlanDay, PaceProfile } from '../types';
import { inferPaceProfile } from './paceInference';

/**
 * Generate a weekly training plan based on goal and recent runs.
 * This is the SINGLE SOURCE OF TRUTH for plan generation.
 */
export function generateWeeklyPlan(
  goal: Goal,
  recentRuns: Run[],
  weekStartDate?: string
): WeeklyPlan {
  // Use provided week start or default to today
  const startDate = weekStartDate 
    ? new Date(weekStartDate)
    : new Date();
  startDate.setHours(0, 0, 0, 0);
  
  // Get pace profile from recent runs (with goal consideration)
  const paceProfile = inferPaceProfile(recentRuns, goal);
  
  // Calculate days until goal
  const raceDate = new Date(goal.raceDate);
  const daysToGoal = Math.ceil((raceDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  return generateWeeklyPlanWithPaces(goal, recentRuns, weekStartDate, paceProfile, daysToGoal);
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
  daysToGoal: number
): WeeklyPlan {
  const startDate = weekStartDate 
    ? new Date(weekStartDate)
    : new Date();
  startDate.setHours(0, 0, 0, 0);
  
  // Ensure week starts on Monday
  const day = startDate.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = startDate.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  startDate.setDate(diff);
  
  // Generate 7 days (Monday through Sunday)
  const days: WeeklyPlanDay[] = [];
  const dayNames = ['Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday', 'Sunday'];
  
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    
    const dayOfWeek = dayNames[i]; // Use index directly since we start on Monday
    const dayPlan = generateDayPlan(
      i,
      dayOfWeek,
      currentDate.toISOString(),
      goal,
      paceProfile,
      daysToGoal,
      recentRuns.length
    );
    
    days.push(dayPlan);
  }
  
  const totalMiles = days.reduce((sum, day) => sum + day.distanceMiles, 0);
  
  return {
    weekStartDate: startDate.toISOString(),
    days,
    totalMiles: Math.round(totalMiles * 10) / 10,
  };
}

function generateDayPlan(
  dayIndex: number,
  dayOfWeek: string,
  date: string,
  goal: Goal,
  paceProfile: PaceProfile,
  daysToGoal: number,
  recentRunCount: number
): WeeklyPlanDay {
  // If insufficient data, recommend easy runs or rest
  if (recentRunCount < 2) {
    if (dayIndex === 0 || dayIndex === 3 || dayIndex === 6) {
      return {
        date,
        dayOfWeek,
        runType: 'rest',
        distanceMiles: 0,
        paceRangeMinPerMile: [0, 0],
        coachingIntent: 'Rest day to allow recovery and adaptation.',
      };
    }
    return {
      date,
      dayOfWeek,
      runType: 'easy',
      distanceMiles: 3.0,
      paceRangeMinPerMile: paceProfile.easyPaceRange,
      coachingIntent: 'Easy run to build base fitness. Keep it conversational.',
    };
  }
  
  // Standard weekly structure for half marathon training
  // Monday: Easy/Recovery
  // Tuesday: Tempo or Interval
  // Wednesday: Easy
  // Thursday: Easy or Tempo
  // Friday: Rest or Easy
  // Saturday: Long Run
  // Sunday: Easy/Recovery
  
  switch (dayIndex) {
    case 0: // Sunday
      return {
        date,
        dayOfWeek,
        runType: 'easy',
        distanceMiles: 4.0,
        paceRangeMinPerMile: paceProfile.easyPaceRange,
        coachingIntent: 'Easy recovery run. Focus on form and staying relaxed.',
      };
      
    case 1: // Monday
      return {
        date,
        dayOfWeek,
        runType: 'easy',
        distanceMiles: 3.5,
        paceRangeMinPerMile: paceProfile.easyPaceRange,
        coachingIntent: 'Easy run to start the week. Build aerobic base.',
      };
      
    case 2: // Tuesday
      if (daysToGoal > 21) {
        // More than 3 weeks out: tempo work
        // Tempo pace should be threshold pace
        return {
          date,
          dayOfWeek,
          runType: 'tempo',
          distanceMiles: 5.0,
          paceRangeMinPerMile: [
            Math.round((paceProfile.thresholdPace - 0.2) * 10) / 10,
            Math.round((paceProfile.thresholdPace + 0.2) * 10) / 10,
          ],
          coachingIntent: `Tempo run at threshold pace (${paceProfile.thresholdPace.toFixed(1)} min/mi). Comfortably hard effort.`,
        };
      } else {
        // Closer to race: intervals
        // Intervals should be faster than threshold, approaching goal pace
        const goalPace = goal.targetTimeMinutes / goal.distance;
        const intervalPace = Math.max(goalPace - 0.3, paceProfile.thresholdPace - 0.5);
        return {
          date,
          dayOfWeek,
          runType: 'interval',
          distanceMiles: 4.0,
          paceRangeMinPerMile: [
            Math.round((intervalPace - 0.2) * 10) / 10,
            Math.round((intervalPace + 0.2) * 10) / 10,
          ],
          coachingIntent: `Interval workout at ${intervalPace.toFixed(1)} min/mi to sharpen speed. Include warm-up and cool-down.`,
        };
      }
      
    case 3: // Wednesday
      return {
        date,
        dayOfWeek,
        runType: 'easy',
        distanceMiles: 4.0,
        paceRangeMinPerMile: paceProfile.easyPaceRange,
        coachingIntent: 'Easy run between harder efforts. Active recovery.',
      };
      
    case 4: // Thursday
      if (daysToGoal > 14) {
        return {
          date,
          dayOfWeek,
          runType: 'tempo',
          distanceMiles: 4.5,
          paceRangeMinPerMile: [
            Math.round((paceProfile.thresholdPace - 0.2) * 10) / 10,
            Math.round((paceProfile.thresholdPace + 0.2) * 10) / 10,
          ],
          coachingIntent: `Moderate tempo run at ${paceProfile.thresholdPace.toFixed(1)} min/mi. Build lactate threshold.`,
        };
      } else {
        return {
          date,
          dayOfWeek,
          runType: 'easy',
          distanceMiles: 3.5,
          paceRangeMinPerMile: [
            Math.round(paceProfile.easyPaceRange[0] * 10) / 10,
            Math.round(paceProfile.easyPaceRange[1] * 10) / 10,
          ],
          coachingIntent: 'Easy run before the weekend long effort.',
        };
      }
      
    case 5: // Friday
      return {
        date,
        dayOfWeek,
        runType: 'rest',
        distanceMiles: 0,
        paceRangeMinPerMile: [0, 0],
        coachingIntent: 'Rest day to prepare for tomorrow\'s long run.',
      };
      
    case 6: // Saturday
      const longRunDistance = Math.min(
        goal.distance * 0.75, // Up to 75% of race distance
        daysToGoal > 14 ? 10 : 8 // Taper if close to race
      );
      return {
        date,
        dayOfWeek,
        runType: 'long',
        distanceMiles: Math.round(longRunDistance * 10) / 10,
        paceRangeMinPerMile: [
          paceProfile.easyPaceRange[0] + 0.5,
          paceProfile.easyPaceRange[1] + 0.5,
        ],
        coachingIntent: `Long run to build endurance. Run at easy pace, focus on time on feet.`,
      };
      
    default:
      return {
        date,
        dayOfWeek,
        runType: 'rest',
        distanceMiles: 0,
        paceRangeMinPerMile: [0, 0],
        coachingIntent: 'Rest day.',
      };
  }
}
