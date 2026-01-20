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

  useEffect(() => {
    const initialize = async () => {
      const runs = castMockRuns(mockData.runs);
      
      // Load goal from API instead of mock data
      let goalData = mockData.goal; // Fallback to mock data
      try {
        const goalResponse = await fetch('/api/goal');
        if (goalResponse.ok) {
          goalData = await goalResponse.json();
        }
      } catch (error) {
        console.error('Error loading goal:', error);
        // Use mock data as fallback
      }
      
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
      />
    </div>
  );
}
