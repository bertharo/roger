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
  
  // Get pace profile from recent runs
  const paceProfile = inferPaceProfile(recentRuns);
  
  // Calculate days until goal
  const raceDate = new Date(goal.raceDate);
  const daysToGoal = Math.ceil((raceDate.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));
  
  // Generate 7 days
  const days: WeeklyPlanDay[] = [];
  const dayNames = ['Sunday', 'Monday', 'Tuesday', 'Wednesday', 'Thursday', 'Friday', 'Saturday'];
  
  for (let i = 0; i < 7; i++) {
    const currentDate = new Date(startDate);
    currentDate.setDate(startDate.getDate() + i);
    
    const dayOfWeek = dayNames[currentDate.getDay()];
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
        return {
          date,
          dayOfWeek,
          runType: 'tempo',
          distanceMiles: 5.0,
          paceRangeMinPerMile: [
            paceProfile.thresholdPace - 0.2,
            paceProfile.thresholdPace + 0.2,
          ],
          coachingIntent: `Tempo run at threshold pace (${paceProfile.thresholdPace.toFixed(1)} min/mi). Comfortably hard effort.`,
        };
      } else {
        // Closer to race: intervals
        return {
          date,
          dayOfWeek,
          runType: 'interval',
          distanceMiles: 4.0,
          paceRangeMinPerMile: [
            paceProfile.thresholdPace - 0.5,
            paceProfile.thresholdPace - 0.2,
          ],
          coachingIntent: 'Interval workout to sharpen speed. Include warm-up and cool-down.',
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
            paceProfile.thresholdPace - 0.2,
            paceProfile.thresholdPace + 0.2,
          ],
          coachingIntent: 'Moderate tempo run. Build lactate threshold.',
        };
      } else {
        return {
          date,
          dayOfWeek,
          runType: 'easy',
          distanceMiles: 3.5,
          paceRangeMinPerMile: paceProfile.easyPaceRange,
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
