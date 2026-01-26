export interface Run {
  id: string;
  date: string; // ISO date string
  distanceMiles: number;
  durationSeconds: number;
  averagePaceMinPerMile: number;
  type?: 'easy' | 'tempo' | 'interval' | 'long' | 'race' | 'recovery';
  elevationFeet?: number;
  notes?: string;
  effort?: number; // 1-10 scale
}

export interface Goal {
  raceDate: string; // ISO date string
  distance: number; // miles
  targetTimeMinutes: number;
}

export interface WeeklyPlanDay {
  date: string; // ISO date string
  dayOfWeek: string; // "Monday", "Tuesday", etc.
  runType: 'easy' | 'tempo' | 'interval' | 'long' | 'rest';
  distanceMiles: number;
  paceRangeMinPerMile: [number, number]; // [min, max]
  coachingIntent: string; // Short sentence explaining the purpose
}

export interface WeeklyPlan {
  weekStartDate: string; // ISO date string
  days: WeeklyPlanDay[];
  totalMiles: number;
}

export interface PaceProfile {
  easyPaceRange: [number, number];
  thresholdPace: number;
  fitnessTrend: 'improving' | 'stable' | 'declining';
}

export interface StatusBarKPIs {
  daysToGoal: number;
  estimatedFinishTime: string; // "1h 35m" format
  confidence: 'low' | 'medium' | 'high';
}

export interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: string;
}

export interface PlanModification {
  dayIndex: number;
  changes: Partial<WeeklyPlanDay>;
  reason: string;
}

// Legacy types for old coachEngine (kept for backward compatibility)
export interface CoachContext {
  goal: Goal;
  runs: Run[];
  userNotes?: string;
}

export interface RecommendedRun {
  type: 'easy' | 'tempo' | 'interval' | 'long' | 'rest';
  distanceMiles: number;
  paceRangeMinPerMile: [number, number]; // [min, max]
  notes: string;
}

export interface KPIs {
  daysToGoal: number;
  weeklyMiles7d: number;
  predictedTimeMinutes: number;
  confidence: 'low' | 'medium' | 'high';
}

export interface CoachResponse {
  assistantMessage: string;
  recommendedNextRun: RecommendedRun;
  kpis: KPIs;
}

export interface FitnessAssessment {
  fitnessLevel: 'beginner' | 'intermediate' | 'advanced';
  weeklyMileage: number; // miles per week they're comfortable with
  daysPerWeek: number; // how many days they can run
  easyPaceMinPerMile?: number; // if they know their easy pace
  recentRunningExperience: 'none' | 'some' | 'regular'; // none = new, some = occasional, regular = consistent
  longestRunMiles?: number; // longest run they've done recently
  completedAt: string; // ISO date string
}
