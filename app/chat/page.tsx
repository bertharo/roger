'use client';

import { useState, useEffect, useCallback } from 'react';
import { Dashboard } from '@/components/dashboard/Dashboard';
import { WeeklyPlan, RecentRun, Goal } from '@/lib/types/dashboard';
import { transformPlanToDashboardFormat, transformRecentRun, transformGoal } from '@/lib/utils/mockData';
import { calculateStatusBarKPIs } from '@/lib/utils/statusBar';
import { formatTime } from '@/lib/utils/formatting';
import { castMockRuns } from '@/lib/utils/typeHelpers';
import { logger } from '@/lib/utils/logger';
import { showToast } from '@/lib/utils/toast';
import { LoadingSkeleton } from '@/components/ui/LoadingSkeleton';
import { ErrorBoundary } from '@/components/ui/ErrorBoundary';
import { FitnessAssessmentPrompt } from '@/components/fitness/FitnessAssessmentPrompt';
import { Run, FitnessAssessment } from '@/lib/types';
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
  const [runs, setRuns] = useState<Run[]>([]);
  const [twelveWeekPlans, setTwelveWeekPlans] = useState<WeeklyPlan[]>([]);
  const [selectedWeekIndex, setSelectedWeekIndex] = useState<number | null>(null);
  const [isInitializing, setIsInitializing] = useState(true);
  const [initializationError, setInitializationError] = useState<string | null>(null);
  const [showAssessmentPrompt, setShowAssessmentPrompt] = useState(false);
  const [hasStravaData, setHasStravaData] = useState(false);

  const loadStravaRuns = useCallback(async (): Promise<Run[]> => {
    let runs: Run[] = [];
    let hasData = false;
    try {
      const stravaResponse = await fetch('/api/strava/activities');
      if (stravaResponse.ok) {
        const stravaData = await stravaResponse.json();
        if (stravaData.runs && stravaData.runs.length > 0) {
          runs = stravaData.runs;
          hasData = true;
        }
      }
    } catch (error) {
      logger.error('Error loading Strava activities:', error);
      // Don't return mock data - let API check for fitness assessment
    }
    setHasStravaData(hasData);
    
    // Check if we need to show fitness assessment prompt
    if (!hasData) {
      try {
        const assessmentResponse = await fetch('/api/fitness-assessment');
        if (assessmentResponse.ok) {
          const data = await assessmentResponse.json();
          if (!data.fitnessLevel) {
            // No assessment, show prompt
            setShowAssessmentPrompt(true);
          } else {
            // Assessment exists, don't show prompt
            setShowAssessmentPrompt(false);
          }
        }
      } catch (error) {
        // If API fails, check localStorage
        const saved = localStorage.getItem('fitness_assessment');
        if (!saved) {
          setShowAssessmentPrompt(true);
        } else {
          setShowAssessmentPrompt(false);
        }
      }
    } else {
      setShowAssessmentPrompt(false);
    }
    
    // Return empty array if no Strava data - let API check for fitness assessment
    return runs;
  }, []);

  const loadGoalData = useCallback(async () => {
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
      logger.error('Error loading goal from API:', error);
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
        logger.error('Error loading goal from localStorage:', e);
      }
    }
    
    return goalData;
  }, []);

  useEffect(() => {
    let isMounted = true;
    let refreshInterval: NodeJS.Timeout | null = null;
    
    const initialize = async () => {
      setIsInitializing(true);
      setInitializationError(null);
      
      try {
        // Parallelize data loading for better performance
        const [runsData, goalData] = await Promise.all([
          loadStravaRuns(),
          loadGoalData(),
        ]);
        
        if (!isMounted) return;
        
        const transformedGoal = transformGoal(goalData);
        setGoal(transformedGoal);
        
        const kpis = calculateStatusBarKPIs(goalData, runsData);
        setEstimatedFinishTime(formatTime(kpis.predictedTimeMinutes));
        setConfidence(kpis.confidence);
        
        const transformedRun = transformRecentRun(runsData);
        setRecentRun(transformedRun);
        setRuns(runsData);
        
        // Load plan and 12-week plan in parallel
        // If no Strava data, pass empty array to let API check for fitness assessment
        await Promise.all([
          loadPlan(runsData.length > 0 ? runsData : undefined, goalData),
          loadTwelveWeekPlan(goalData, runsData.length > 0 ? runsData : []),
        ]);
      } catch (error) {
        logger.error('Error during initialization:', error);
        if (isMounted) {
          setInitializationError('Failed to load data. Please refresh the page.');
          showToast.error('Failed to load your training data');
        }
      } finally {
        if (isMounted) {
          setIsInitializing(false);
        }
      }
    };
    
    initialize();
    
    // Auto-refresh Strava data every 5 minutes (only when tab is visible)
    const setupRefresh = () => {
      refreshInterval = setInterval(async () => {
        // Only refresh if tab is visible
        if (document.visibilityState === 'visible') {
          try {
            const runsData = await loadStravaRuns();
            if (isMounted) {
              setRuns(runsData);
              const transformedRun = transformRecentRun(runsData);
              setRecentRun(transformedRun);
              
              // Reload goal and plan with fresh data
              const currentGoal = await loadGoalData();
              await loadPlan(runsData, currentGoal);
            }
          } catch (error) {
            logger.error('Error auto-refreshing Strava data:', error);
          }
        }
      }, 5 * 60 * 1000); // 5 minutes
    };
    
    setupRefresh();
    
    // Pause refresh when tab is hidden
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden' && refreshInterval) {
        clearInterval(refreshInterval);
        refreshInterval = null;
      } else if (document.visibilityState === 'visible' && !refreshInterval) {
        setupRefresh();
      }
    };
    
    document.addEventListener('visibilitychange', handleVisibilityChange);
    
    return () => {
      isMounted = false;
      if (refreshInterval) {
        clearInterval(refreshInterval);
      }
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [loadStravaRuns, loadGoalData]);
  
  const loadTwelveWeekPlan = useCallback(async (goalData: any, runsData: Run[]) => {
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
          // Pass undefined if no runs - let API check for fitness assessment
          await loadPlan(runsData.length > 0 ? runsData : undefined, goalData, transformed[currentWeekIndex].weekStartISO);
        } else if (transformed[0]) {
          // Fallback to first week if current week not found
          setSelectedWeekIndex(0);
          await loadPlan(runsData.length > 0 ? runsData : undefined, goalData, transformed[0].weekStartISO);
        }
      }
    } catch (error) {
      logger.error('Failed to load 12-week plan:', error);
      showToast.error('Failed to load 12-week plan');
    }
  }, []);
  
  const handleWeekSelect = useCallback((weekIndex: number, weekPlan: WeeklyPlan) => {
    logger.debug('Week selected:', weekIndex);
    setSelectedWeekIndex(weekIndex);
    // Create a new object to ensure React detects the change
    setPlan({ ...weekPlan });
    setExpandedDayIndex(null);
  }, []);

  const loadPlan = useCallback(async (runs?: Run[], goalData?: any, weekStart?: string) => {
    try {
      // Pass runs data to plan API if available, otherwise pass undefined to let API check for fitness assessment
      const response = await fetch('/api/plan', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          runs: runs, // Pass undefined if no runs - API will check for fitness assessment
          goal: goalData || mockData.goal,
          weekStart: weekStart, // Pass the week start date if provided
        }),
      });
      
      if (response.ok) {
        const planData = await response.json();
        const transformed = transformPlanToDashboardFormat(planData);
        logger.debug('Plan loaded successfully');
        setPlan(transformed);
      } else {
        throw new Error('Failed to load plan');
      }
    } catch (error) {
      logger.error('Failed to load plan:', error);
      showToast.error('Failed to load training plan');
    }
  }, []);

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
            showToast.error('OpenAI API quota exceeded. Please check your account billing.');
          } else {
            showToast.error('Rate limit exceeded. Please wait a moment and try again.');
          }
        } else if (response.status === 401) {
          showToast.error('Authentication required. Please sign in again.');
        } else if (response.status >= 500) {
          showToast.error('Server error. Please try again later.');
        }
      }
    } catch (error) {
      logger.error('Error sending message:', error);
      const errorMessage: ChatMessage = {
        role: 'assistant',
        content: 'Sorry, I encountered an error. Please check your connection and try again.',
        timestamp: new Date(),
      };
      setChatMessages(prev => [...prev, errorMessage]);
      showToast.error('Failed to send message. Please check your connection.');
    } finally {
      setChatLoading(false);
    }
  };

  if (isInitializing) {
    return <LoadingSkeleton />;
  }

  if (initializationError) {
    return (
      <div className="mx-auto max-w-md min-h-screen bg-white flex items-center justify-center px-4">
        <div className="text-center">
          <h2 className="text-lg font-semibold text-gray-900 mb-2">Failed to Load</h2>
          <p className="text-sm text-gray-600 mb-4">{initializationError}</p>
          <button
            onClick={() => window.location.reload()}
            className="px-4 py-2 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors"
            aria-label="Reload page"
          >
            Reload Page
          </button>
        </div>
      </div>
    );
  }

  const handleAssessmentComplete = async (assessment: FitnessAssessment) => {
    setShowAssessmentPrompt(false);
    showToast.success('Fitness assessment saved! Your plan will be updated.');
    // Reload both weekly and 12-week plans - don't pass runs, let API check for fitness assessment
    const goalData = await loadGoalData();
    // Reload 12-week plan first (which will also load the current week)
    await loadTwelveWeekPlan(goalData, []); // Pass empty array to let API check for assessment
  };

  const handleAssessmentDismiss = () => {
    setShowAssessmentPrompt(false);
    // Store dismissal in localStorage so we don't show it again for a while
    localStorage.setItem('fitness_assessment_dismissed', new Date().toISOString());
  };

  return (
    <ErrorBoundary>
      <div className="mx-auto max-w-md min-h-screen bg-white">
        {showAssessmentPrompt && !hasStravaData && (
          <FitnessAssessmentPrompt
            onComplete={handleAssessmentComplete}
            onDismiss={handleAssessmentDismiss}
          />
        )}
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
    </ErrorBoundary>
  );
}
