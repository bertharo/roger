'use client';

import { WeeklyPlan, RecentRun, Goal } from '@/lib/types/dashboard';
import { TopSummary } from './TopSummary';
import { CoachSummary } from './CoachSummary';
import { WeekPlanList } from './WeekPlanList';
import { ChatBar } from './ChatBar';
import { useState, useEffect } from 'react';

interface DashboardProps {
  plan: WeeklyPlan | null;
  recentRun: RecentRun | null;
  goal: Goal | null;
  estimatedFinishTime?: string;
  confidence?: 'low' | 'medium' | 'high';
  onChatSend: (message: string) => void;
  chatLoading?: boolean;
  expandedDayIndex?: number | null;
  onDayExpand?: (index: number | null) => void;
}

export function Dashboard({
  plan,
  recentRun,
  goal,
  estimatedFinishTime,
  confidence,
  onChatSend,
  chatLoading,
  expandedDayIndex,
  onDayExpand,
}: DashboardProps) {
  const [chatPlaceholder, setChatPlaceholder] = useState("Ask about your plan...");

  useEffect(() => {
    if (expandedDayIndex !== null && expandedDayIndex !== undefined && plan) {
      const day = plan.days[expandedDayIndex];
      if (day) {
        setChatPlaceholder(`Ask about ${day.dayLabel}'s ${day.title.toLowerCase()}...`);
      }
    } else {
      setChatPlaceholder("Ask about your plan...");
    }
  }, [expandedDayIndex, plan]);

  const handleDayClick = (index: number | null) => {
    onDayExpand?.(index);
  };

  return (
    <div className="min-h-screen flex flex-col bg-white">
      <div className="px-4">
        <TopSummary
          goal={goal}
          estimatedFinishTime={estimatedFinishTime}
          confidence={confidence}
        />
        
        <CoachSummary recentRun={recentRun} plan={plan} />
        
        <div className="flex-1 overflow-y-auto pb-20">
          <WeekPlanList plan={plan} onDayClick={handleDayClick} expandedIndex={expandedDayIndex} />
        </div>
      </div>

      <ChatBar
        placeholder={chatPlaceholder}
        onSend={onChatSend}
        isLoading={chatLoading}
      />
    </div>
  );
}
