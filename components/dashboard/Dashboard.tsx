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
import { UsageIndicator } from './UsageIndicator';
import { WeekComparison } from './WeekComparison';
import { OnboardingBanner } from '@/components/onboarding/OnboardingBanner';
import { DataSourceIndicator } from './DataSourceIndicator';
import { useState, useEffect } from 'react';
import { Run } from '@/lib/types';
import { getMondayOfWeek, getSundayOfWeek } from '@/lib/utils/weekHelpers';
import { logger } from '@/lib/utils/logger';

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
  const [showWeekComparison, setShowWeekComparison] = useState(false);
  const [isStravaConnected, setIsStravaConnected] = useState(false);
  const [lastSyncTime, setLastSyncTime] = useState<Date | null>(null);

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

  useEffect(() => {
    // Check Strava connection status
    const checkStravaStatus = async () => {
      try {
        const response = await fetch('/api/strava/status');
        if (response.ok) {
          const data = await response.json();
          setIsStravaConnected(data.connected || false);
          if (data.lastSync) {
            setLastSyncTime(new Date(data.lastSync));
          }
        }
      } catch (error) {
        logger.error('Error checking Strava status:', error);
      }
    };
    
    checkStravaStatus();
    // Check every 30 seconds
    const interval = setInterval(checkStravaStatus, 30000);
    return () => clearInterval(interval);
  }, []);

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
        
        {/* Onboarding Banner */}
        <OnboardingBanner 
          goal={goal}
          isStravaConnected={isStravaConnected}
        />
        
        {/* Data Source Indicator */}
        <DataSourceIndicator 
          isStravaConnected={isStravaConnected}
          lastSyncTime={lastSyncTime}
        />
        
        <CoachSummary recentRun={recentRun} plan={plan} />
        
        {/* KPIs */}
        {runs.length > 0 && <KPIs runs={runs} />}
        
        {/* Usage Indicator */}
        <UsageIndicator />
        
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
          <div className="flex items-center justify-between mb-1">
            <h2 className="text-base font-semibold text-gray-900">This Week</h2>
            <div className="flex items-center gap-3">
              {twelveWeekPlans && twelveWeekPlans.length > 0 && selectedWeekIndex !== null && selectedWeekIndex !== undefined && (
                <>
                  <span className="text-xs text-gray-500">
                    Week {selectedWeekIndex + 1} of {twelveWeekPlans.length}
                  </span>
                  {plan && runs.length > 0 && (
                    <button
                      onClick={() => setShowWeekComparison(true)}
                      className="text-xs text-blue-600 hover:text-blue-700 font-medium"
                    >
                      Compare
                    </button>
                  )}
                </>
              )}
            </div>
          </div>
          {plan && (
            <div className="flex items-center gap-4 mt-1">
              <p className="text-xs text-gray-500">
                <span className="font-medium text-gray-900">{plan.totalMilesPlanned.toFixed(1)}</span> miles planned
              </p>
              {runs.length > 0 && (() => {
                // Calculate actual miles for current week (Monday-Sunday)
                const today = new Date();
                const mondayOfThisWeek = getMondayOfWeek(today);
                const sundayOfThisWeek = getSundayOfWeek(today);
                const weekStart = new Date(plan.weekStartISO);
                weekStart.setHours(0, 0, 0, 0);
                
                // Check if this plan is for the current week
                const isCurrentWeek = weekStart.getTime() === mondayOfThisWeek.getTime();
                
                if (isCurrentWeek) {
                  const currentWeekRuns = runs.filter(run => {
                    const runDate = new Date(run.date);
                    runDate.setHours(0, 0, 0, 0);
                    return runDate >= mondayOfThisWeek && runDate <= sundayOfThisWeek;
                  });
                  const actualMiles = currentWeekRuns.reduce((sum, run) => sum + run.distanceMiles, 0);
                  const difference = actualMiles - plan.totalMilesPlanned;
                  
                  return (
                    <p className="text-xs">
                      <span className={`font-medium ${difference >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                        {actualMiles.toFixed(1)}
                      </span>
                      {' '}miles actual
                      {difference !== 0 && (
                        <span className={`ml-1 ${difference >= 0 ? 'text-green-600' : 'text-orange-600'}`}>
                          ({difference >= 0 ? '+' : ''}{difference.toFixed(1)})
                        </span>
                      )}
                    </p>
                  );
                }
                return null;
              })()}
            </div>
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
      
      {/* Week Comparison Modal */}
      {showWeekComparison && plan && (
        <WeekComparison
          plan={plan}
          actualRuns={runs}
          onClose={() => setShowWeekComparison(false)}
        />
      )}
    </div>
  );
}
