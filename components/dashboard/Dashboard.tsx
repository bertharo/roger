'use client';

import { WeeklyPlan, RecentRun, Goal } from '@/lib/types/dashboard';
import { TopSummary } from './TopSummary';
import { CoachSummary } from './CoachSummary';
import { WeekPlanList } from './WeekPlanList';
import { ChatBar } from './ChatBar';
import { ChatMessages } from './ChatMessages';
import { KPIs } from './KPIs';
import { TwelveWeekPlan } from './TwelveWeekPlan';
import { RaceDayView } from './RaceDayView';
import { useState, useEffect } from 'react';
import { Run } from '@/lib/types';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

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
  chatMessages?: ChatMessage[];
  runs?: Run[];
  twelveWeekPlans?: WeeklyPlan[];
  selectedWeekIndex?: number | null;
  onWeekSelect?: (weekIndex: number, plan: WeeklyPlan) => void;
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
  chatMessages = [],
  runs = [],
  twelveWeekPlans,
  selectedWeekIndex,
  onWeekSelect,
}: DashboardProps) {
  const [chatPlaceholder, setChatPlaceholder] = useState("Ask about your plan...");
  const [showRaceDayView, setShowRaceDayView] = useState(false);

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
      {/* Fixed Header Section */}
      <div className="flex-shrink-0">
        <TopSummary
          goal={goal}
          estimatedFinishTime={estimatedFinishTime}
          confidence={confidence}
        />
        
        <CoachSummary recentRun={recentRun} plan={plan} />
        
        {/* KPIs */}
        {runs.length > 0 && <KPIs runs={runs} />}
        
        {/* 12-Week Plan */}
        {twelveWeekPlans && twelveWeekPlans.length > 0 && (
          <TwelveWeekPlan
            plans={twelveWeekPlans}
            goal={goal}
            onWeekSelect={onWeekSelect}
            onRaceDayClick={() => setShowRaceDayView(true)}
            selectedWeekIndex={selectedWeekIndex}
          />
        )}
        
        {/* Current Week Plan */}
        <div className="px-4 pt-6 pb-3">
          <h2 className="text-base font-semibold text-gray-900 mb-1">This Week</h2>
          {plan && (
            <p className="text-xs text-gray-500">{plan.totalMilesPlanned} miles planned</p>
          )}
        </div>
      </div>

      {/* Scrollable Content */}
      <div className="flex-1 overflow-y-auto">
        <WeekPlanList plan={plan} onDayClick={handleDayClick} expandedIndex={expandedDayIndex} />
      </div>

      {/* Fixed Bottom Section - Chat */}
      <div className="flex-shrink-0 border-t border-gray-100/50 bg-white">
        {/* Chat Messages */}
        {chatMessages.length > 0 && (
          <div className="max-h-48 overflow-y-auto">
            <ChatMessages messages={chatMessages} />
          </div>
        )}
        
        <ChatBar
          placeholder={chatPlaceholder}
          onSend={onChatSend}
          isLoading={chatLoading}
        />
      </div>
      
      {/* Race Day View Modal */}
      {showRaceDayView && goal && (
        <RaceDayView
          goal={goal}
          onClose={() => setShowRaceDayView(false)}
        />
      )}
    </div>
  );
}
