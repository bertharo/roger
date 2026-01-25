'use client';

import { Run } from '@/lib/types';
import { getMondayOfWeek, getSundayOfWeek } from '@/lib/utils/weekHelpers';

interface KPIsProps {
  runs: Run[];
}

export function KPIs({ runs }: KPIsProps) {
  if (!runs || runs.length === 0) {
    return null;
  }

  // Calculate current week (Monday-Sunday) mileage
  const today = new Date();
  const mondayOfThisWeek = getMondayOfWeek(today);
  const sundayOfThisWeek = getSundayOfWeek(today);
  
  const currentWeekRuns = runs.filter(run => {
    const runDate = new Date(run.date);
    runDate.setHours(0, 0, 0, 0);
    return runDate >= mondayOfThisWeek && runDate <= sundayOfThisWeek;
  });
  
  const currentWeekMiles = currentWeekRuns.reduce((sum, run) => sum + run.distanceMiles, 0);
  
  // Calculate days elapsed in current week (Monday = 0, Sunday = 6)
  const dayOfWeek = today.getDay();
  const daysElapsed = dayOfWeek === 0 ? 6 : dayOfWeek - 1; // Convert Sunday (0) to 6, others to 0-5
  const daysInWeek = 7;
  
  // Calculate average daily miles for current week
  const avgDailyMiles = daysElapsed > 0 ? currentWeekMiles / (daysElapsed + 1) : currentWeekMiles;
  
  // Calculate total runs in current week
  const runsThisWeek = currentWeekRuns.length;

  return (
    <div className="px-4 py-4 border-b border-gray-100/50">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">This Week (Mon-Sun)</h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-lg font-semibold text-gray-900">{currentWeekMiles.toFixed(1)}</div>
          <div className="text-xs text-gray-500">Miles</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">{avgDailyMiles.toFixed(1)}</div>
          <div className="text-xs text-gray-500">Avg Daily</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">{runsThisWeek}</div>
          <div className="text-xs text-gray-500">Runs</div>
        </div>
      </div>
    </div>
  );
}
