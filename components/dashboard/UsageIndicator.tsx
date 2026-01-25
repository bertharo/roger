'use client';

import { useEffect, useState } from 'react';
import { logger } from '@/lib/utils/logger';

interface UsageData {
  chat_messages: number;
  plan_generations: number;
  chat_limit: number;
  plan_limit: number;
}

export function UsageIndicator() {
  const [usage, setUsage] = useState<UsageData | null>(null);
  const [loading, setLoading] = useState(true);
  
  useEffect(() => {
    const fetchUsage = async () => {
      try {
        const res = await fetch('/api/usage');
        if (res.ok) {
          const data = await res.json();
          setUsage(data);
        }
      } catch (error) {
        logger.error('Error fetching usage:', error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchUsage();
    // Refresh every 30 seconds
    const interval = setInterval(fetchUsage, 30000);
    return () => clearInterval(interval);
  }, []);
  
  if (loading || !usage) {
    return null;
  }
  
  const chatPercent = (usage.chat_messages / usage.chat_limit) * 100;
  const planPercent = (usage.plan_generations / usage.plan_limit) * 100;
  
  return (
    <div className="px-4 py-3 border-b border-gray-100/50 bg-gray-50/50">
      <div className="text-xs text-gray-600 mb-2 font-medium">Daily Usage</div>
      <div className="space-y-2.5">
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600">Chat Messages</span>
            <span className={`font-medium ${
              chatPercent >= 90 ? 'text-red-600' :
              chatPercent >= 70 ? 'text-yellow-600' : 'text-gray-900'
            }`}>
              {usage.chat_messages} / {usage.chat_limit}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                chatPercent >= 90 ? 'bg-red-500' :
                chatPercent >= 70 ? 'bg-yellow-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, chatPercent)}%` }}
            />
          </div>
        </div>
        <div>
          <div className="flex justify-between text-xs mb-1">
            <span className="text-gray-600">Plan Generations</span>
            <span className={`font-medium ${
              planPercent >= 90 ? 'text-red-600' :
              planPercent >= 70 ? 'text-yellow-600' : 'text-gray-900'
            }`}>
              {usage.plan_generations} / {usage.plan_limit}
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className={`h-1.5 rounded-full transition-all ${
                planPercent >= 90 ? 'bg-red-500' :
                planPercent >= 70 ? 'bg-yellow-500' : 'bg-blue-500'
              }`}
              style={{ width: `${Math.min(100, planPercent)}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
}
