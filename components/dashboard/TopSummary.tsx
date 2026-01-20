import { Goal } from '@/lib/types/dashboard';
import { daysBetween } from '@/lib/utils/formatting';
import Link from 'next/link';

interface TopSummaryProps {
  goal: Goal | null;
  estimatedFinishTime?: string;
  confidence?: 'low' | 'medium' | 'high';
}

export function TopSummary({ goal, estimatedFinishTime, confidence }: TopSummaryProps) {
  if (!goal) {
    return (
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100/50 py-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Set a goal to get your plan</p>
          <Link 
            href="/settings"
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Settings
          </Link>
        </div>
      </div>
    );
  }

  if (!goal.raceDateISO || !goal.distanceMi || goal.distanceMi <= 0) {
    return (
      <div className="sticky top-0 z-50 bg-white border-b border-gray-100/50 py-2.5">
        <div className="flex items-center justify-between">
          <p className="text-xs text-gray-500">Set a goal to get your plan</p>
          <Link 
            href="/settings"
            className="text-xs text-blue-600 hover:text-blue-700 font-medium"
          >
            Settings
          </Link>
        </div>
      </div>
    );
  }

  const daysToGoal = daysBetween(new Date().toISOString(), goal.raceDateISO);
  const validDays = isNaN(daysToGoal) ? 0 : Math.max(0, daysToGoal);
  const raceName = goal.raceName || `${goal.distanceMi} mi race`;
  
  const isValidEstimate = estimatedFinishTime && 
    estimatedFinishTime !== 'NaN' && 
    !estimatedFinishTime.includes('NaN') &&
    estimatedFinishTime.trim() !== '';
  
  const confidenceSymbol = confidence === 'high' ? '↑' : confidence === 'medium' ? '→' : '↓';
  const confidenceLabel = confidence ? confidence.charAt(0).toUpperCase() + confidence.slice(1) : 'Medium';

  return (
    <div className="sticky top-0 z-50 bg-white border-b border-gray-100/50 py-2.5">
      <div className="flex items-center justify-between text-xs text-gray-500">
        <span className="font-medium text-gray-900 truncate pr-2">{raceName}</span>
        <div className="flex items-center gap-2 flex-shrink-0">
          <span>{validDays} days</span>
          {isValidEstimate && <span>{estimatedFinishTime} est</span>}
          <span className="text-gray-400">
            {confidenceSymbol} {confidenceLabel}
          </span>
          <Link 
            href="/settings"
            className="ml-2 text-gray-400 hover:text-gray-600"
            title="Settings"
          >
            <svg className="w-4 h-4" fill="none" viewBox="0 0 24 24" stroke="currentColor">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10.325 4.317c.426-1.756 2.924-1.756 3.35 0a1.724 1.724 0 002.573 1.066c1.543-.94 3.31.826 2.37 2.37a1.724 1.724 0 001.065 2.572c1.756.426 1.756 2.924 0 3.35a1.724 1.724 0 00-1.066 2.573c.94 1.543-.826 3.31-2.37 2.37a1.724 1.724 0 00-2.572 1.065c-.426 1.756-2.924 1.756-3.35 0a1.724 1.724 0 00-2.573-1.066c-1.543.94-3.31-.826-2.37-2.37a1.724 1.724 0 00-1.065-2.572c-1.756-.426-1.756-2.924 0-3.35a1.724 1.724 0 001.066-2.573c-.94-1.543.826-3.31 2.37-2.37.996.608 2.296.07 2.572-1.065z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 12a3 3 0 11-6 0 3 3 0 016 0z" />
            </svg>
          </Link>
        </div>
      </div>
    </div>
  );
}
