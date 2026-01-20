export type RunType = "easy" | "workout" | "long" | "rest";

export interface DayPlan {
  dateISO: string;
  dayLabel: string; // Mon, Tue...
  runType: RunType;
  title: string; // "Easy", "Intervals", "Long Run", "Rest"
  distanceMi: number | null; // null for rest
  paceRangeMinPerMi?: [number, number]; // e.g. [7.33, 7.58]
  purpose: string;
  structure: string[]; // bullet steps
  notes?: string;
}

export interface WeeklyPlan {
  weekStartISO: string;
  totalMilesPlanned: number;
  days: DayPlan[];
}

export interface RecentRun {
  dateISO: string;
  distanceMi: number;
  avgPaceMinPerMi: number;
  title: string;
}

export interface Goal {
  raceName?: string;
  raceDateISO: string;
  distanceMi: number;
  targetTimeMinutes: number;
}
