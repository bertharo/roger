'use client';

import { WeeklyPlan, Goal } from '@/lib/types/dashboard';
import { useState } from 'react';

interface TwelveWeekPlanProps {
  plans: WeeklyPlan[];
  goal: Goal | null;
  onWeekSelect?: (weekIndex: number, plan: WeeklyPlan) => void;
  onRaceDayClick?: () => void;
  selectedWeekIndex?: number | null;
}

export function TwelveWeekPlan({ 
  plans, 
  goal, 
  onWeekSelect, 
  onRaceDayClick,
  selectedWeekIndex 
}: TwelveWeekPlanProps) {
  if (!plans || plans.length === 0) {
    return null;
  }

  const maxMiles = Math.max(...plans.map(p => p.totalMilesPlanned || 0));
  
  // Find which week contains the race date
  const getRaceWeekIndex = (): number | null => {
    if (!goal?.raceDateISO) return null;
    
    const raceDate = new Date(goal.raceDateISO);
    raceDate.setHours(0, 0, 0, 0);
    
    for (let i = 0; i < plans.length; i++) {
      const weekStart = new Date(plans[i].weekStartISO);
      weekStart.setHours(0, 0, 0, 0);
      const weekEnd = new Date(weekStart);
      weekEnd.setDate(weekEnd.getDate() + 7);
      
      if (raceDate >= weekStart && raceDate < weekEnd) {
        return i;
      }
    }
    return null;
  };
  
  const raceWeekIndex = getRaceWeekIndex();
  
  const handleWeekClick = (index: number) => {
    if (index === raceWeekIndex && onRaceDayClick) {
      onRaceDayClick();
    } else {
      onWeekSelect?.(index, plans[index]);
    }
  };

  return (
    <div className="px-4 py-6 border-b border-gray-100/50">
      <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide mb-4">12-Week Plan</h3>
      
      <div className="space-y-2">
        {plans.map((plan, index) => {
          const weekNumber = index + 1;
          const miles = plan.totalMilesPlanned || 0;
          const percentage = maxMiles > 0 ? (miles / maxMiles) * 100 : 0;
          const isSelected = selectedWeekIndex === index;
          const isRaceWeek = index === raceWeekIndex;
          
          return (
            <button
              key={index}
              onClick={() => handleWeekClick(index)}
              className={`w-full text-left p-3 rounded-lg transition-all duration-200 ${
                isRaceWeek
                  ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 shadow-sm hover:shadow-md hover:scale-[1.02]'
                  : isSelected 
                    ? 'bg-gray-100 border border-gray-300' 
                    : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {isRaceWeek && (
                    <span className="text-lg animate-pulse" role="img" aria-label="race">
                      🏁
                    </span>
                  )}
                  <span className={`text-sm font-medium ${
                    isRaceWeek ? 'text-orange-700' : 'text-gray-900'
                  }`}>
                    {isRaceWeek ? `Week ${weekNumber} - RACE WEEK!` : `Week ${weekNumber}`}
                  </span>
                </div>
                <span className={`text-sm ${isRaceWeek ? 'text-orange-600 font-semibold' : 'text-gray-600'}`}>
                  {miles.toFixed(1)} mi
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`rounded-full h-2 transition-all ${
                    isRaceWeek 
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-500' 
                      : 'bg-gray-900'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              {isRaceWeek && goal && (
                <div className="mt-2 pt-2 border-t border-yellow-300">
                  <p className="text-xs text-orange-700 font-medium">
                    🎯 {goal.raceName || `${goal.distanceMi} mi race`} • Click to view race day plan
                  </p>
                </div>
              )}
            </button>
          );
        })}
      </div>
    </div>
  );
}
