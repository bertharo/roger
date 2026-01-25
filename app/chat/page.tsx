'use client';

import { useState, useEffect } from 'react';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { WeeklyPlan, RecentRun, Goal } from '@/lib/types/dashboard';
import { transformPlanToDashboardFormat, transformRecentRun, transformGoal } from '@/lib/utils/mockData';
import { calculateStatusBarKPIs } from '@/lib/utils/statusBar';
import { formatTime } from '@/lib/utils/formatting';
import { castMockRuns } from '@/lib/utils/typeHelpers';
import mockData from '@/data/stravaMock.json';

interface ChatMessage {
  role: 'user' | 'assistant';
  content: string;
  timestamp: Date;
}

export default function ChatPage() {
  const [plan, setPlan] = useState<WeeklyPlan | null>(null);
  const [recentRun, setRecentRun] = useState<RecentRun | null>(null);
  const [goal, setGoal] = useState<Goal | null>(null);
  const [estimatedFinishTime, setEstimatedFinishTime] = useState<string>();
  const [confidence, setConfidence] = useState<'low' | 'medium' | 'high'>('medium');
  const [chatLoading, setChatLoading] = useState(false);
  const [expandedDayIndex, setExpandedDayIndex] = useState<number | null>(null);
  const [chatMessages, setChatMessages] = useState<ChatMessage[]>([]);
  const [runs, setRuns] = useState<any[]>([]);
  const [twelveWeekPlans, setTwelveWeekPlans] = useState<WeeklyPlan[]>([]);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);

  const loadStravaRuns = async () => {
    let runs = castMockRuns(mockData.runs);
    try {
      const stravaResponse = await fetch('/api/strava/activities');
      if (stravaResponse.ok) {
        const stravaData = await stravaResponse.json();
        if (stravaData.runs && stravaData.runs.length > 0) {
          runs = stravaData.runs;
        }
      }
    } catch (error) {
      console.error('Error loading Strava activities:', error);
      // Use mock data as fallback
    }
    return runs;
  };

  useEffect(() => {
    const initialize = async () => {
      // Try to load Strava data first, fallback to mock data
      const runs = await loadStravaRuns();
      
      // Load goal from API first (database), then localStorage, then mock data
      let goalData = mockData.goal; // Fallback to mock data
      
      // Try API first (database) - this is the source of truth
      try {
        const goalResponse = await fetch('/api/goal', {
          credentials: 'include',
        });
        if (goalResponse.ok) {
          const apiGoal = await goalResponse.json();
          // Check if we got a real goal (not default)
          if (apiGoal.raceDate && apiGoal.raceDate !== '2024-03-15T08:00:00Z') {
            goalData = apiGoal;
            // Also save to localStorage for faster access next time
            try {
              const transformed = transformGoal(goalData);
              if (transformed) {
                localStorage.setItem('user_goal', JSON.stringify(transformed));
              }
            } catch (e) {
              // Ignore localStorage errors
            }
          }
        }
      } catch (error) {
        console.error('Error loading goal from API:', error);
      }
      
      // Fallback to localStorage if API didn't return a real goal
      if (goalData === mockData.goal) {
        try {
          const savedGoal = localStorage.getItem('user_goal');
          if (savedGoal) {
            const parsed = JSON.parse(savedGoal);
            // Convert dashboard format to core format
            goalData = {
              raceDate: parsed.raceDateISO,
              distance: parsed.distanceMi,
              targetTimeMinutes: parsed.targetTimeMinutes,
            };
          }
        } catch (e) {
          console.error('Error loading goal from localStorage:', e);
        }
      }
      
      const transformedGoal = transformGoal(goalData);
      setGoal(transformedGoal);
      
      const kpis = calculateStatusBarKPIs(goalData, runs);
      setEstimatedFinishTime(formatTime(kpis.predictedTimeMinutes));
      setConfidence(kpis.confidence);
      
      const transformedRun = transformRecentRun(runs);
      setRecentRun(transformedRun);
      setRuns(runs);
      
      await loadPlan(runs, goalData);
      await loadTwelveWeekPlan(goalData, runs);
    };
    initialize();
    
    // Auto-refresh Strava data every 5 minutes
    const refreshInterval = setInterval(async () => {
      try {
        const runs = await loadStravaRuns();
        setRuns(runs);
        const transformedRun = transformRecentRun(runs);
        setRecentRun(transformedRun);
        // Reload goal and plan with fresh data
        let currentGoal = mockData.goal;
        try {
          const goalResponse = await fetch('/api/goal', { credentials: 'include' });
          if (goalResponse.ok) {
            const apiGoal = await goalResponse.json();
            if (apiGoal.raceDate && apiGoal.raceDate !== '2024-03-15T08:00:00Z') {
              currentGoal = apiGoal;
            }
          }
        } catch (e) {
          // Use fallback goal
        }
        await loadPlan(runs, currentGoal);
      } catch (error) {
        console.error('Error auto-refreshing Strava data:', error);
      }
    }, 5 * 60 * 1000); // 5 minutes
    
    return () => clearInterval(refreshInterval);
  }, []);
  
  const loadTwelveWeekPlan = async (goalData: any, runsData: any[]) => {
    try {
      const response = await fetch('/api/plan/twelve-week', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          goal: goalData,
          runs: runsData,
        }),
      });
      
      if (response.ok) {
        const plansData = await response.json();
        const transformed = plansData.map((p: any) => transformPlanToDashboardFormat(p));
        setTwelveWeekPlans(transformed);
        
        // Auto-select current week
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const day = today.getDay();
        const diff = today.getDate() - day + (day === 0 ? -6 : 1);
        const mondayOfThisWeek = new Date(today);
        mondayOfThisWeek.setDate(diff);
        mondayOfThisWeek.setHours(0, 0, 0, 0);
        
        // Find the current week index
        let currentWeekIndex = 0;
        for (let i = 0; i < transformed.length; i++) {
          const weekStart = new Date(transformed[i].weekStartISO);
          weekStart.setHours(0, 0, 0, 0);
          if (mondayOfThisWeek.getTime() === weekStart.getTime()) {
            currentWeekIndex = i;
            break;
          }
        }
        
        // Auto-select and load current week
        if (transformed[currentWeekIndex]) {
          setSelectedWeekIndex(currentWeekIndex);
          await loadPlan(runsData, goalData, transformed[currentWeekIndex].weekStartISO);
        } else if (transformed[0]) {
          // Fallback to first week if current week not found
          setSelectedWeekIndex(0);
          await loadPlan(runsData, goalData, transformed[0].weekStartISO);
        }
      }
    } catch (error) {
      console.error('Failed to load 12-week plan:', error);
    }
  };
  
  const handleWeekSelect = (weekIndex: number, weekPlan: WeeklyPlan) => {
    console.log('handleWeekSelect called:', weekIndex, weekPlan);
    console.log('Week plan days:', weekPlan.days);
    setSelectedWeekIndex(weekIndex);
    // Create a new object to ensure React detects the change
    setPlan({ ...weekPlan });
    setExpandedDayIndex(null);
    console.log('Plan state updated, new plan:', { ...weekPlan });
  };

  const loadPlan = async (runs?: any[], goalData?: any, weekStart?: string) => {
    try {
      // Pass runs data to plan API if available
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          runs: runs || castMockRuns(mockData.runs),
          goal: goalData || mockData.goal,
          weekStart: weekStart, // Pass the week start date if provided
        }),
      });
      
      if (response.ok) {
        const planData = await response.json();
        const transformed = transformPlanToDashboardFormat(planData);
        console.log('Plan loaded:', transformed);
        setPlan(transformed);
      }
    } catch (error) {
      console.error('Failed to load plan:', error);
    }
  };

  const handleChatSend = async (message: string) => {
    // Add user message to chat history
    const userMessage: ChatMessage = {
      role: 'user',
      content: message,
      timestamp: new Date(),
    };
    setChatMessages(prev => [...prev, userMessage]);
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
          runs, // Pass actual runs
          goal, // Pass actual goal
          chatHistory: chatMessages.map(msg => ({
            role: msg.role,
            content: msg.content,
            timestamp: msg.timestamp.toISOString(),
          })),
        }),
      });

      if (response.ok) {
        const data = await response.json();
        
        // Add assistant response to chat history
        if (data.assistantMessage) {
          const assistantMessage: ChatMessage = {
            role: 'assistant',
            content: data.assistantMessage,
            timestamp: new Date(),
          };
          setChatMessages(prev => [...prev, assistantMessage]);
        }
        
        // Update plan if modified
        if (data.updatedPlan) {
          const transformed = transformPlanToDashboardFormat(data.updatedPlan);
          setPlan(transformed);
        }
      } else {
        // Handle error response
        const errorData = await response.json().catch(() => ({ error: 'Unknown error' }));
        
        // Add error message to chat
        const errorMessage: ChatMessage = {
          role: 'assistant',
          content: `Sorry, I encountered an error: ${errorData.error || 'Failed to process your message'}`,
          timestamp: new Date(),
        };
        setChatMessages(prev => [...prev, errorMessage]);
        
        if (response.status === 429) {
          if (errorData.errorType === 'quota_exceeded') {
            alert('⚠️ OpenAI API quota exceeded.\n\nPlease check your OpenAI account billing and plan. The chat feature is temporarily unavailable until you add credits or upgrade your plan.\n\nVisit: https://platform.openai.com/account/billing');
          } else {
            alert('⚠️ Rate limit exceeded. Please wait a moment and try again.');
          }
        }
      }
    } catch (error) {
      console.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check your connection and try again.',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
      alert('Failed to send message. Please check your connection and try again.');
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
        chatMessages={chatMessages}
        runs={runs}
        twelveWeekPlans={twelveWeekPlans}
        selectedWeekIndex={selectedWeekIndex}
        onWeekSelect={handleWeekSelect}
      />
    </div>
  );
}
