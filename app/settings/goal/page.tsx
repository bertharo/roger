'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { Goal } from '@/lib/types/dashboard';
import { logger } from '@/lib/utils/logger';
import { showToast } from '@/lib/utils/toast';

export default function GoalSettingsPage() {
  const [goal, setGoal] = useState<Goal | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    // Load current goal from API
    loadGoal();
  }, []);

  const loadGoal = async () => {
    setIsLoading(true);
    try {
      // Try localStorage first (more reliable than cookies for client-side)
      const savedGoal = localStorage.getItem('user_goal');
      if (savedGoal) {
        try {
          const goal = JSON.parse(savedGoal);
          setGoal(goal);
          setIsLoading(false);
          return;
        } catch (e) {
          logger.error('Error parsing localStorage goal:', e);
        }
      }
      
      // Fallback to API/cookies
      const response = await fetch('/api/goal', {
        credentials: 'include',
      });
      if (response.ok) {
        const data = await response.json();
        
        // Transform core format to dashboard format
        let raceName = '';
        if (data.distance === 13.1) {
          raceName = 'Half Marathon';
        } else if (data.distance === 26.2) {
          raceName = 'Marathon';
        } else if (data.distance === 6.2) {
          raceName = '10K';
        } else if (data.distance === 3.1) {
          raceName = '5K';
        } else {
          raceName = `${data.distance} mi race`;
        }
        
        const goalData = {
          raceName,
          raceDateISO: data.raceDate,
          distanceMi: data.distance,
          targetTimeMinutes: data.targetTimeMinutes,
        };
        
        setGoal(goalData);
        // Also save to localStorage for faster access
        localStorage.setItem('user_goal', JSON.stringify(goalData));
      } else {
        // Use default if API fails
        const defaultGoal = {
          raceName: 'Half Marathon',
          raceDateISO: '2024-03-15T08:00:00Z',
          distanceMi: 13.1,
          targetTimeMinutes: 95,
        };
        setGoal(defaultGoal);
      }
    } catch (error) {
      logger.error('Error loading goal:', error);
      // Use default on error
      setGoal({
        raceName: 'Half Marathon',
        raceDateISO: '2024-03-15T08:00:00Z',
        distanceMi: 13.1,
        targetTimeMinutes: 95,
      });
    } finally {
      setIsLoading(false);
    }
  };

  const handleSave = async () => {
    if (!goal) return;
    
    // Validate form
    const errors: Record<string, string> = {};
    if (!goal.raceDateISO) {
      errors.raceDateISO = 'Race date is required';
    }
    if (!goal.distanceMi || goal.distanceMi <= 0) {
      errors.distanceMi = 'Distance must be greater than 0';
    }
    if (!goal.targetTimeMinutes || goal.targetTimeMinutes <= 0) {
      errors.targetTimeMinutes = 'Target time must be greater than 0';
    }
    
    if (Object.keys(errors).length > 0) {
      showToast.error('Please fill in all required fields');
      return;
    }
    
    logger.debug('Saving goal:', goal);
    
    setIsSaving(true);
    try {
      // Try to save to server first (database)
      const response = await fetch('/api/goal', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify(goal),
        credentials: 'include',
      });
      
      const data = await response.json();
      logger.debug('Save response:', data);
      
      if (response.ok && data.success) {
        // Database save succeeded
        // Also save to localStorage as backup
        localStorage.setItem('user_goal', JSON.stringify(goal));
        logger.info('Goal saved to database and localStorage');
        showToast.success('Goal saved successfully!');
        window.history.back();
      } else {
        // Database save failed, fallback to localStorage
        logger.warn('Database save failed, using localStorage:', data);
        localStorage.setItem('user_goal', JSON.stringify(goal));
        showToast.error(`Goal saved locally. ${data.error || 'Database unavailable'}. Please check your DATABASE_URL in Vercel.`);
        window.history.back();
      }
    } catch (error: any) {
      logger.error('Error saving goal:', error);
      // Fallback to localStorage
      localStorage.setItem('user_goal', JSON.stringify(goal));
      showToast.error('Goal saved locally. Please check your connection and DATABASE_URL configuration.');
      window.history.back();
    } finally {
      setIsSaving(false);
    }
  };

  const handleChange = (field: keyof Goal, value: string | number) => {
    if (!goal) return;
    setGoal({
      ...goal,
      [field]: value,
    });
  };

  if (!goal) {
    return (
      <div className="mx-auto max-w-md min-h-screen bg-white flex items-center justify-center">
        <p className="text-sm text-gray-500">Loading...</p>
      </div>
    );
  }

  // Format date for input (YYYY-MM-DD)
  const raceDateInput = goal.raceDateISO ? goal.raceDateISO.split('T')[0] : '';

  return (
    <div className="mx-auto max-w-md min-h-screen bg-white">
      <div className="px-4 py-6">
        {/* Header */}
        <div className="flex items-center gap-3 mb-6">
          <Link 
            href="/settings"
            className="text-gray-400 hover:text-gray-600"
          >
            <svg className="w-5 h-5" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-lg font-semibold text-gray-900">Edit Goal</h1>
        </div>

        {/* Form */}
        <div className="space-y-6">
          {/* Race Name */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Race Name
            </label>
            <input
              type="text"
              value={goal.raceName || ''}
              onChange={(e) => handleChange('raceName', e.target.value)}
              placeholder="e.g., Boston Marathon"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
            />
          </div>

          {/* Race Date */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Race Date
            </label>
            <input
              type="date"
              value={raceDateInput}
              onChange={(e) => {
                const dateISO = e.target.value ? `${e.target.value}T08:00:00Z` : '';
                handleChange('raceDateISO', dateISO);
              }}
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
              aria-label="Race date"
              aria-required="true"
            />
          </div>

          {/* Distance */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Distance (miles)
            </label>
            <input
              type="number"
              step="0.1"
              min="0.1"
              max="100"
              value={goal.distanceMi || ''}
              onChange={(e) => handleChange('distanceMi', parseFloat(e.target.value) || 0)}
              placeholder="13.1"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
              aria-label="Distance in miles"
              aria-required="true"
            />
            <p className="mt-1 text-xs text-gray-500">
              Common distances: 5K (3.1), 10K (6.2), Half (13.1), Marathon (26.2)
            </p>
          </div>

          {/* Target Time */}
          <div>
            <label className="block text-sm font-medium text-gray-900 mb-2">
              Target Time (minutes)
            </label>
            <input
              type="number"
              step="1"
              min="1"
              value={goal.targetTimeMinutes || ''}
              onChange={(e) => handleChange('targetTimeMinutes', parseInt(e.target.value) || 0)}
              placeholder="95"
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-gray-400 focus:border-gray-400"
              aria-label="Target time in minutes"
              aria-required="true"
            />
            <p className="mt-1 text-xs text-gray-500">
              {goal.targetTimeMinutes ? `Target pace: ${(goal.targetTimeMinutes / goal.distanceMi).toFixed(2)} min/mi` : 'Enter target time'}
            </p>
          </div>

          {/* Actions */}
          <div className="flex gap-3 pt-4">
            <Link
              href="/settings"
              className="flex-1 py-2 px-4 text-sm font-medium text-gray-900 border border-gray-200 rounded-lg hover:bg-gray-50 transition-colors text-center"
            >
              Cancel
            </Link>
            <button
              onClick={handleSave}
              disabled={isSaving || !goal.raceDateISO || !goal.distanceMi || !goal.targetTimeMinutes}
              className="flex-1 py-2 px-4 text-sm font-medium text-white bg-gray-900 rounded-lg hover:bg-gray-800 transition-colors disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-gray-900 focus:ring-offset-2"
              aria-busy={isSaving}
            >
              {isSaving ? 'Saving...' : 'Save Goal'}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
