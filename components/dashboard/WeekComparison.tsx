'use client';

import { WeeklyPlan } from '@/lib/types/dashboard';
import { Run } from '@/lib/types';
import { formatDistance, formatPace } from '@/lib/utils/formatting';

interface WeekComparisonProps {
  plan: WeeklyPlan;
  actualRuns: Run[];
  onClose?: () => void;
}

export function WeekComparison({ plan, actualRuns, onClose }: WeekComparisonProps) {
  if (!plan) return null;
  
  // Filter runs to this week (Monday-Sunday)
  const weekStart = new Date(plan.weekStartISO);
  weekStart.setHours(0, 0, 0, 0);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekEnd.getDate() + 7);
  weekEnd.setHours(23, 59, 59, 999);
  
  const weekRuns = actualRuns.filter(run => {
    const runDate = new Date(run.date);
    return runDate >= weekStart && runDate <= weekEnd;
  });
  
  // Group runs by day
  const runsByDay: Record<string, Run[]> = {};
  weekRuns.forEach(run => {
    const runDate = new Date(run.date);
    const dayKey = runDate.toISOString().split('T')[0];
    if (!runsByDay[dayKey]) {
      runsByDay[dayKey] = [];
    }
    runsByDay[dayKey].push(run);
  });
  
  // Calculate totals
  const plannedTotal = plan.totalMilesPlanned || 0;
  const actualTotal = weekRuns.reduce((sum, run) => sum + run.distanceMiles, 0);
  const difference = actualTotal - plannedTotal;
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4">
      <div className="bg-white rounded-lg max-w-2xl w-full max-h-[90vh] overflow-y-auto">
        <div className="sticky top-0 bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
          <div>
            <h2 className="text-lg font-semibold text-gray-900">Week Comparison</h2>
            <p className="text-sm text-gray-500">
              {new Date(plan.weekStartISO).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })} -{' '}
              {new Date(weekEnd).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-400 hover:text-gray-600 transition-colors"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
        
        <div className="px-6 py-4">
          {/* Summary */}
          <div className="grid grid-cols-3 gap-4 mb-6">
            <div className="bg-gray-50 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Planned</div>
              <div className="text-2xl font-semibold text-gray-900">{plannedTotal.toFixed(1)} mi</div>
            </div>
            <div className="bg-blue-50 rounded-lg p-4">
              <div className="text-xs text-gray-500 mb-1">Actual</div>
              <div className="text-2xl font-semibold text-blue-900">{actualTotal.toFixed(1)} mi</div>
            </div>
            <div className={`rounded-lg p-4 ${difference >= 0 ? 'bg-green-50' : 'bg-orange-50'}`}>
              <div className="text-xs text-gray-500 mb-1">Difference</div>
              <div className={`text-2xl font-semibold ${difference >= 0 ? 'text-green-900' : 'text-orange-900'}`}>
                {difference >= 0 ? '+' : ''}{difference.toFixed(1)} mi
              </div>
            </div>
          </div>
          
          {/* Day-by-day comparison */}
          <div className="space-y-4">
            <h3 className="text-sm font-semibold text-gray-700 uppercase tracking-wide mb-3">Day by Day</h3>
            {plan.days.map((day, index) => {
              const dayDate = new Date(day.dateISO);
              const dayKey = dayDate.toISOString().split('T')[0];
              const dayRuns = runsByDay[dayKey] || [];
              const dayActualTotal = dayRuns.reduce((sum, run) => sum + run.distanceMiles, 0);
              
              return (
                <div key={index} className="border border-gray-200 rounded-lg p-4">
                  <div className="flex items-center justify-between mb-3">
                    <div>
                      <div className="font-medium text-gray-900">{day.dayLabel}</div>
                      <div className="text-xs text-gray-500">
                        {dayDate.toLocaleDateString('en-US', { month: 'short', day: 'numeric' })}
                      </div>
                    </div>
                    <div className="text-right">
                      <div className="text-sm font-medium text-gray-900">{day.title}</div>
                      {day.distanceMi !== null && (
                        <div className="text-xs text-gray-500">
                          {day.paceRangeMinPerMi ? `${day.paceRangeMinPerMi[0]}-${day.paceRangeMinPerMi[1]} min/mi` : ''}
                        </div>
                      )}
                    </div>
                  </div>
                  
                  <div className="grid grid-cols-2 gap-4">
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Planned</div>
                      <div className="text-sm font-medium text-gray-900">
                        {day.distanceMi !== null ? `${day.distanceMi.toFixed(1)} mi` : 'Rest'}
                      </div>
                      {day.purpose && (
                        <div className="text-xs text-gray-500 mt-1">{day.purpose}</div>
                      )}
                    </div>
                    <div>
                      <div className="text-xs text-gray-500 mb-1">Actual</div>
                      {dayRuns.length > 0 ? (
                        <div className="space-y-1">
                          {dayRuns.map((run, runIndex) => (
                            <div key={runIndex} className="text-sm">
                              <span className="font-medium text-blue-900">
                                {formatDistance(run.distanceMiles)} mi
                              </span>
                              <span className="text-gray-500 ml-2">
                                @ {formatPace(run.averagePaceMinPerMile)}/mi
                              </span>
                            </div>
                          ))}
                          {dayRuns.length > 1 && (
                            <div className="text-xs text-gray-500 mt-1">
                              Total: {dayActualTotal.toFixed(1)} mi
                            </div>
                          )}
                        </div>
                      ) : (
                        <div className="text-sm text-gray-400">No run recorded</div>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
