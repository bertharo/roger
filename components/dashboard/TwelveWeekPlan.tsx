'use client';

import { WeeklyPlan } from '@/lib/types/dashboard';
import { useState } from 'react';

interface TwelveWeekPlanProps {
  plans: WeeklyPlan[];
  onWeekSelect?: (weekIndex: number, plan: WeeklyPlan) => void;
  selectedWeekIndex?: number | null;
}

export function TwelveWeekPlan({ plans, onWeekSelect, selectedWeekIndex }: TwelveWeekPlanProps) {
  if (!plans || plans.length === 0) {
    return null;
  }

  const maxMiles = Math.max(...plans.map(p => p.totalMilesPlanned || 0));
  
  const handleWeekClick = (index: number) => {
    onWeekSelect?.(index, plans[index]);
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
          
          return (
            <button
              key={index}
              onClick={() => handleWeekClick(index)}
              className={`w-full text-left p-2 rounded-lg transition-colors ${
                isSelected 
                  ? 'bg-gray-100 border border-gray-300' 
                  : 'hover:bg-gray-50 border border-transparent'
              }`}
            >
              <div className="flex items-center justify-between mb-1">
                <span className="text-sm font-medium text-gray-900">
                  Week {weekNumber}
                </span>
                <span className="text-sm text-gray-600">{miles.toFixed(1)} mi</span>
              </div>
              <div className="w-full bg-gray-200 rounded-full h-2">
                <div
                  className="bg-gray-900 rounded-full h-2 transition-all"
                  style={{ width: `${percentage}%` }}
                />
              </div>
            </button>
          );
        })}
      </div>
    </div>
  );
}
