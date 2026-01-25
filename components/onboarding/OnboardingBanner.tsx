'use client';

import { useState } from 'react';
import Link from 'next/link';
import { Goal } from '@/lib/types/dashboard';

interface OnboardingBannerProps {
  goal: Goal | null;
  isStravaConnected: boolean;
  onDismiss?: () => void;
}

export function OnboardingBanner({ goal, isStravaConnected, onDismiss }: OnboardingBannerProps) {
  const [isDismissed, setIsDismissed] = useState(false);

  // Check if user has dismissed onboarding
  const hasDismissed = typeof window !== 'undefined' 
    ? localStorage.getItem('onboarding_dismissed') === 'true'
    : false;

  if (isDismissed || hasDismissed) {
    return null;
  }

  // Determine what step user is on
  const needsGoal = !goal || !goal.raceDateISO || goal.raceDateISO === '2024-03-15T08:00:00Z';
  const needsStrava = !isStravaConnected;

  const handleDismiss = () => {
    setIsDismissed(true);
    if (typeof window !== 'undefined') {
      localStorage.setItem('onboarding_dismissed', 'true');
    }
    onDismiss?.();
  };

  if (needsGoal) {
    return (
      <div className="bg-blue-50 border-b border-blue-200 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">👋</span>
              <h3 className="text-sm font-semibold text-blue-900">Welcome to Roger!</h3>
            </div>
            <p className="text-xs text-blue-700 mb-2">
              Set your race goal to get a personalized 12-week training plan.
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/settings/goal"
                className="text-xs font-medium text-white bg-blue-600 hover:bg-blue-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Set Goal
              </Link>
              <button
                onClick={handleDismiss}
                className="text-xs text-blue-600 hover:text-blue-700 font-medium"
              >
                Maybe later
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-blue-400 hover:text-blue-600 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  if (needsStrava) {
    return (
      <div className="bg-orange-50 border-b border-orange-200 px-4 py-3">
        <div className="flex items-start justify-between gap-3">
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-1">
              <span className="text-lg">🏃</span>
              <h3 className="text-sm font-semibold text-orange-900">Connect Strava</h3>
            </div>
            <p className="text-xs text-orange-700 mb-2">
              Connect your Strava account to see your actual runs compared to your plan.
            </p>
            <div className="flex items-center gap-2">
              <Link
                href="/settings"
                className="text-xs font-medium text-white bg-orange-600 hover:bg-orange-700 px-3 py-1.5 rounded-lg transition-colors"
              >
                Connect Strava
              </Link>
              <button
                onClick={handleDismiss}
                className="text-xs text-orange-600 hover:text-orange-700 font-medium"
              >
                Maybe later
              </button>
            </div>
          </div>
          <button
            onClick={handleDismiss}
            className="text-orange-400 hover:text-orange-600 transition-colors flex-shrink-0"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>
      </div>
    );
  }

  // Both complete - show success message briefly
  return null;
}
