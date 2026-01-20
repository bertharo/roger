'use client';

import { WeeklyPlan } from '@/lib/types/dashboard';
import { DayRow } from './DayRow';
import { useState } from 'react';

interface WeekPlanListProps {
  plan: WeeklyPlan | null;
  onDayClick?: (dayIndex: number | null) => void;
  expandedIndex?: number | null;
}

export function WeekPlanList({ plan, onDayClick, expandedIndex: controlledExpandedIndex }: WeekPlanListProps) {
  const [internalExpandedIndex, setInternalExpandedIndex] = useState<number | null>(null);
  const expandedIndex = controlledExpandedIndex !== undefined ? controlledExpandedIndex : internalExpandedIndex;

  if (!plan) {
    return (
      <div className="py-8 text-center">
        <p className="text-sm text-gray-400">Loading your plan...</p>
      </div>
    );
  }

  const handleToggle = (index: number) => {
    const newIndex = expandedIndex === index ? null : index;
    if (controlledExpandedIndex === undefined) {
      setInternalExpandedIndex(newIndex);
    }
    onDayClick?.(newIndex);
  };

  return (
    <div>
      {/* Section Header - minimal */}
      <div className="pt-5 pb-4">
        <div className="flex items-baseline justify-between">
          <h2 className="text-sm font-semibold text-gray-900">This Week</h2>
          <span className="text-xs text-gray-400">{plan.totalMilesPlanned} miles planned</span>
        </div>
      </div>

      {/* Flat list - clean rows */}
      <div className="bg-white">
        {plan.days.map((day, index) => (
          <DayRow
            key={day.dateISO}
            day={day}
            isExpanded={expandedIndex === index}
            onToggle={() => handleToggle(index)}
          />
        ))}
      </div>
    </div>
  );
}
