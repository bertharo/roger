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
  
  // Find which week is the current week (today's week)
  const getCurrentWeekIndex = (): number | null => {
    if (!plans || plans.length === 0) {
      return null;
    }
    
    try {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      
      for (let i = 0; i < plans.length; i++) {
        const weekStart = new Date(plans[i].weekStartISO);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        
        // Check if today falls within this week
        if (today >= weekStart && today < weekEnd) {
          return i;
        }
      }
      
      // If today is before the plan starts, return 0 (first week)
      const firstWeekStart = new Date(plans[0].weekStartISO);
      firstWeekStart.setHours(0, 0, 0, 0);
      if (today < firstWeekStart) {
        return 0;
      }
      
      // If today is after the plan ends, return the last week
      const lastWeekStart = new Date(plans[plans.length - 1].weekStartISO);
      lastWeekStart.setHours(0, 0, 0, 0);
      const lastWeekEnd = new Date(lastWeekStart);
      lastWeekEnd.setDate(lastWeekEnd.getDate() + 7);
      if (today >= lastWeekEnd) {
        return plans.length - 1;
      }
    } catch (error) {
      console.error('Error detecting current week:', error);
    }
    
    return null;
  };
  
  // Find which week contains the race date
  const getRaceWeekIndex = (): number | null => {
    if (!goal?.raceDateISO) {
      return null;
    }
    
    try {
      const raceDate = new Date(goal.raceDateISO);
      raceDate.setHours(0, 0, 0, 0);
      
      // The 12-week plan starts 12 weeks before race, so race should be in week 12 (index 11)
      // But let's check all weeks to be safe
      for (let i = 0; i < plans.length; i++) {
        const weekStart = new Date(plans[i].weekStartISO);
        weekStart.setHours(0, 0, 0, 0);
        const weekEnd = new Date(weekStart);
        weekEnd.setDate(weekEnd.getDate() + 7);
        
        // Check if race date falls within this week (inclusive start, inclusive end for last day)
        // For the last week, include the end date
        const isLastWeek = i === plans.length - 1;
        if (isLastWeek) {
          if (raceDate >= weekStart && raceDate <= weekEnd) {
            return i;
          }
        } else {
          if (raceDate >= weekStart && raceDate < weekEnd) {
            return i;
          }
        }
      }
      
      // Fallback: if race date is very close to the end of the plan, assume it's week 12
      const lastWeekStart = new Date(plans[plans.length - 1]?.weekStartISO);
      lastWeekStart.setHours(0, 0, 0, 0);
      const daysDiff = Math.ceil((raceDate.getTime() - lastWeekStart.getTime()) / (1000 * 60 * 60 * 24));
      if (daysDiff >= 0 && daysDiff <= 14) {
        return plans.length - 1; // Last week
      }
    } catch (error) {
      console.error('Error detecting race week:', error);
    }
    
    return null;
  };
  
  const currentWeekIndex = getCurrentWeekIndex();
  const raceWeekIndex = getRaceWeekIndex();
  
  // Calculate overall progress (0-100%)
  const calculateProgress = (): number => {
    if (currentWeekIndex === null) return 0;
    return Math.round(((currentWeekIndex + 1) / plans.length) * 100);
  };
  
  const overallProgress = calculateProgress();
  
  const handleWeekClick = (index: number) => {
    console.log('Week clicked:', index, { onWeekSelect: !!onWeekSelect, onRaceDayClick: !!onRaceDayClick });
    const isLastWeek = index === plans.length - 1;
    const isRaceWeek = index === raceWeekIndex || (isLastWeek && !raceWeekIndex && goal);
    
    if (isRaceWeek && onRaceDayClick) {
      console.log('Opening race day view');
      onRaceDayClick();
    } else if (onWeekSelect) {
      console.log('Selecting week:', index, plans[index]);
      onWeekSelect(index, plans[index]);
    } else {
      console.warn('No onWeekSelect handler provided');
    }
  };

  // Show debug info in development
  const showDebug = process.env.NODE_ENV === 'development';
  
  return (
    <div className="px-4 py-6 border-b border-gray-100/50">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wide">12-Week Plan</h3>
        {currentWeekIndex !== null && (
          <div className="flex items-center gap-2">
            <span className="text-xs text-gray-600">
              Week {currentWeekIndex + 1} of {plans.length}
            </span>
            <div className="w-16 bg-gray-200 rounded-full h-1.5">
              <div
                className="bg-blue-500 h-1.5 rounded-full transition-all"
                style={{ width: `${overallProgress}%` }}
              />
            </div>
          </div>
        )}
      </div>
      
      {showDebug && goal && (
        <div className="mb-2 p-2 bg-blue-50 text-xs text-blue-800 rounded">
          Debug: Race date: {goal.raceDateISO}, Race week index: {raceWeekIndex !== null ? raceWeekIndex + 1 : 'not found'}, Current week: {currentWeekIndex !== null ? currentWeekIndex + 1 : 'not found'}
        </div>
      )}
      
      <div className="space-y-2">
        {plans.map((plan, index) => {
          const weekNumber = index + 1;
          const miles = plan.totalMilesPlanned || 0;
          const percentage = maxMiles > 0 ? (miles / maxMiles) * 100 : 0;
          const isSelected = selectedWeekIndex === index;
          const isCurrentWeek = index === currentWeekIndex;
          const isRaceWeek = index === raceWeekIndex;
          const isPastWeek = currentWeekIndex !== null && index < currentWeekIndex;
          const isFutureWeek = currentWeekIndex !== null && index > currentWeekIndex;
          
          // Always show race week styling if it's the last week (fallback)
          const isLastWeek = index === plans.length - 1;
          
          return (
            <button
              key={index}
              onClick={(e) => {
                e.preventDefault();
                e.stopPropagation();
                console.log('Button clicked directly:', index);
                handleWeekClick(index);
              }}
              onMouseDown={(e) => {
                console.log('Mouse down on week:', index);
              }}
              className={`w-full text-left p-3 rounded-lg transition-all duration-200 cursor-pointer relative z-10 ${
                (isRaceWeek || (isLastWeek && !raceWeekIndex && goal))
                  ? 'bg-gradient-to-r from-yellow-50 to-orange-50 border-2 border-yellow-400 shadow-sm hover:shadow-md hover:scale-[1.02]'
                  : isCurrentWeek
                    ? 'bg-blue-50 border-2 border-blue-400 shadow-sm'
                    : isSelected 
                      ? 'bg-gray-100 border border-gray-300' 
                      : isPastWeek
                        ? 'bg-gray-50 border border-gray-100 opacity-75'
                        : 'hover:bg-gray-50 border border-transparent'
              }`}
              type="button"
              style={{ pointerEvents: 'auto' }}
            >
              <div className="flex items-center justify-between mb-1">
                <div className="flex items-center gap-2">
                  {isCurrentWeek && (
                    <span className="text-xs font-semibold text-blue-600 bg-blue-100 px-2 py-0.5 rounded-full">
                      CURRENT
                    </span>
                  )}
                  {(isRaceWeek || (isLastWeek && !raceWeekIndex && goal)) && !isCurrentWeek && (
                    <span className="text-lg animate-pulse" role="img" aria-label="race">
                      🏁
                    </span>
                  )}
                  <span className={`text-sm font-medium ${
                    (isRaceWeek || (isLastWeek && !raceWeekIndex && goal)) ? 'text-orange-700' 
                    : isCurrentWeek ? 'text-blue-700'
                    : isPastWeek ? 'text-gray-500'
                    : 'text-gray-900'
                  }`}>
                    {(isRaceWeek || (isLastWeek && !raceWeekIndex && goal)) ? `Week ${weekNumber} - RACE WEEK!` 
                    : isCurrentWeek ? `Week ${weekNumber} - This Week`
                    : `Week ${weekNumber}`}
                  </span>
                </div>
                <span className={`text-sm ${
                  (isRaceWeek || (isLastWeek && !raceWeekIndex && goal)) ? 'text-orange-600 font-semibold' 
                  : isCurrentWeek ? 'text-blue-600 font-semibold'
                  : isPastWeek ? 'text-gray-400'
                  : 'text-gray-600'
                }`}>
                  {miles.toFixed(1)} mi
                </span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                <div
                  className={`rounded-full h-2 transition-all ${
                    (isRaceWeek || (isLastWeek && !raceWeekIndex && goal))
                      ? 'bg-gradient-to-r from-yellow-400 to-orange-500' 
                      : 'bg-gray-900'
                  }`}
                  style={{ width: `${percentage}%` }}
                />
              </div>
              {(isRaceWeek || (isLastWeek && !raceWeekIndex && goal)) && goal && (
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
