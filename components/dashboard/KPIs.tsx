'use client';

import { Run } from '@/lib/types';

interface KPIsProps {
  runs: Run[];
}

export function KPIs({ runs }: KPIsProps) {
  if (!runs || runs.length === 0) {
    return null;
  }

  // Calculate last 7 days mileage
  const now = new Date();
  const sevenDaysAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
  
  const lastWeekRuns = runs.filter(run => {
    const runDate = new Date(run.date);
    return runDate >= sevenDaysAgo;
  });
  
  const lastWeekMiles = lastWeekRuns.reduce((sum, run) => sum + run.distanceMiles, 0);
  
  // Calculate average daily miles (last 7 days)
  const avgDailyMiles = lastWeekMiles / 7;
  
  // Calculate total runs in last 7 days
  const runsLastWeek = lastWeekRuns.length;

  return (
    <div className="px-4 py-4 border-b border-gray-100/50">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-3">This Week</h3>
      <div className="grid grid-cols-3 gap-4">
        <div>
          <div className="text-lg font-semibold text-gray-900">{lastWeekMiles.toFixed(1)}</div>
          <div className="text-xs text-gray-500">Miles (7d)</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">{avgDailyMiles.toFixed(1)}</div>
          <div className="text-xs text-gray-500">Avg Daily</div>
        </div>
        <div>
          <div className="text-lg font-semibold text-gray-900">{runsLastWeek}</div>
          <div className="text-xs text-gray-500">Runs</div>
        </div>
      </div>
    </div>
  );
}
