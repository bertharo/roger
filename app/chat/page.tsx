'use client';

import { useState, useEffect } from 'react';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { WeeklyPlan, RecentRun, Goal } from '@/lib/types/dashboard';
import { transformPlanToDashboardFormat, transformRecentRun, transformGoal } from '@/lib/utils/mockData';
import { calculateStatusBarKPIs } from '@/lib/utils/statusBar';
import { formatTime } from '@/lib/utils/formatting';
import { castMockRuns } from '@/lib/utils/typeHelpers';
import mockData from '@/data/stravaMock.json';

export default function ChatPage() {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [recentRun, setRecentRun] = useState<RecentRun | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [estimatedFinishTime, setEstimatedFinishTime] = useState<string>();
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high'>('medium');
  const [chatLoading, setChatLoading] = useState(false);
  const [expandedDayIndex, setExpandedDayIndex] = useState<number | null>(null);

  useEffect(() => {
    const initialize = async () => {
      const runs = castMockRuns(mockData.runs);
      const goalData = mockData.goal;
      
      const transformedGoal = transformGoal(goalData);
      setGoal(transformedGoal);
      
      const kpis = calculateStatusBarKPIs(goalData, runs);
      setEstimatedFinishTime(formatTime(kpis.predictedTimeMinutes));
      setConfidence(kpis.confidence);
      
      const transformedRun = transformRecentRun(mockData.runs);
      setRecentRun(transformedRun);
      
      await loadPlan();
    };
    initialize();
  }, []);

  const loadPlan = async () => {
    try {
      const response = await fetch('/api/plan');
      if (response.ok) {
        const planData = await response.json();
        const transformed = transformPlanToDashboardFormat(planData);
        setPlan(transformed);
      }
    } catch (error) {
      console.error('Failed to load plan:', error);
    }
  };

  const handleChatSend = async (message: string) => {
    setChatLoading(true);
    try {
      const response = await fetch('/api/chat', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          message,
          currentPlan: plan,
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        if (data.updatedPlan) {
          const transformed = transformPlanToDashboardFormat(data.updatedPlan);
          setPlan(transformed);
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
    } finally {
      setChatLoading(false);
    }
  };

  return (
    <div className="mx-auto max-w-md min-h-screen bg-white">
      <Dashboard
        plan={plan}
        recentRun={recentRun}
        goal={goal}
        estimatedFinishTime={estimatedFinishTime}
        confidence={confidence}
        onChatSend={handleChatSend}
        chatLoading={chatLoading}
        expandedDayIndex={expandedDayIndex}
        onDayExpand={setExpandedDayIndex}
      />
    </div>
  );
}
