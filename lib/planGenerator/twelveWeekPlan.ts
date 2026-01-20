import { Goal, Run, WeeklyPlan } from '../types';
import { generateWeeklyPlan } from './index';
import { inferPaceProfile } from './paceInference';

/**
 * Generate a 12-week training plan
 */
export function generateTwelveWeekPlan(
  goal: Goal,
  recentRuns: Run[]
): WeeklyPlan[] {
  const plans: WeeklyPlan[] = [];
  const raceDate = new Date(goal.raceDate);
  
  // Start 12 weeks before race
  const startDate = new Date(raceDate);
  startDate.setDate(startDate.getDate() - 12 * 7);
  
  // Generate 12 weekly plans
  for (let week = 0; week < 12; week++) {
    const weekStart = new Date(startDate);
    weekStart.setDate(startDate.getDate() + week * 7);
    
    const plan = generateWeeklyPlan(goal, recentRuns, weekStart.toISOString());
    plans.push(plan);
  }
  
  return plans;
}

/**
 * Calculate total miles for a week
 */
export function getWeekTotalMiles(plan: WeeklyPlan): number {
  return plan.days.reduce((sum, day) => sum + day.distanceMiles, 0);
}
