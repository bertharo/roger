'use client';

import { Goal } from '@/lib/types/dashboard';
import { formatPace, formatTime } from '@/lib/utils/formatting';

interface RaceDayViewProps {
  goal: Goal;
  onClose: () => void;
}

export function RaceDayView({ goal, onClose }: RaceDayViewProps) {
  const raceDate = new Date(goal.raceDateISO);
  const goalPace = goal.targetTimeMinutes / goal.distanceMi;
  const raceName = goal.raceName || `${goal.distanceMi} mi race`;
  
  // Format date nicely
  const formattedDate = raceDate.toLocaleDateString('en-US', {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  
  return (
    <div className="fixed inset-0 bg-black/50 z-50 flex items-center justify-center p-4 animate-in fade-in">
      <div className="bg-white rounded-2xl shadow-2xl max-w-md w-full max-h-[90vh] overflow-y-auto animate-in slide-in-from-bottom-4">
        {/* Header */}
        <div className="bg-gradient-to-r from-yellow-400 via-orange-400 to-red-400 p-6 rounded-t-2xl">
          <div className="flex items-start justify-between">
            <div className="flex-1">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-3xl animate-bounce" role="img" aria-label="trophy">
                  🏆
                </span>
                <h2 className="text-2xl font-bold text-white">Race Day</h2>
              </div>
              <p className="text-white/90 text-lg font-semibold">{raceName}</p>
            </div>
            <button
              onClick={onClose}
              className="text-white/80 hover:text-white transition-colors p-1"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>
        </div>
        
        {/* Content */}
        <div className="p-6 space-y-6">
          {/* Date */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-blue-100 rounded-full flex items-center justify-center">
              <span className="text-blue-600 text-xl">📅</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Race Date</p>
              <p className="text-lg font-semibold text-gray-900">{formattedDate}</p>
            </div>
          </div>
          
          {/* Distance */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-green-100 rounded-full flex items-center justify-center">
              <span className="text-green-600 text-xl">📍</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Distance</p>
              <p className="text-lg font-semibold text-gray-900">{goal.distanceMi} miles</p>
            </div>
          </div>
          
          {/* Target Time */}
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-purple-100 rounded-full flex items-center justify-center">
              <span className="text-purple-600 text-xl">⏱️</span>
            </div>
            <div>
              <p className="text-sm text-gray-500">Target Time</p>
              <p className="text-lg font-semibold text-gray-900">{formatTime(goal.targetTimeMinutes)}</p>
            </div>
          </div>
          
          {/* Goal Pace */}
          <div className="bg-gradient-to-r from-orange-50 to-yellow-50 rounded-xl p-4 border border-orange-200">
            <p className="text-sm text-gray-600 mb-1">Target Pace</p>
            <p className="text-3xl font-bold text-orange-600">{formatPace(goalPace)}</p>
            <p className="text-xs text-gray-500 mt-1">per mile</p>
          </div>
          
          {/* Race Day Tips */}
          <div className="bg-blue-50 rounded-xl p-4 border border-blue-200">
            <h3 className="text-sm font-semibold text-blue-900 mb-2 flex items-center gap-2">
              <span>💡</span> Race Day Tips
            </h3>
            <ul className="text-sm text-blue-800 space-y-1">
              <li>• Get a good night's sleep (7-9 hours)</li>
              <li>• Eat a light breakfast 2-3 hours before</li>
              <li>• Arrive early to warm up properly</li>
              <li>• Start conservatively, negative split if possible</li>
              <li>• Trust your training - you've got this! 🚀</li>
            </ul>
          </div>
          
          {/* Motivational Message */}
          <div className="text-center py-4">
            <p className="text-lg font-semibold text-gray-900 mb-1">
              You've trained for this moment!
            </p>
            <p className="text-sm text-gray-600">
              All those miles, all those workouts - they're about to pay off. 
              Run strong, run smart, and most importantly, enjoy the journey! 🎉
            </p>
          </div>
        </div>
        
        {/* Footer */}
        <div className="p-4 border-t border-gray-200 bg-gray-50 rounded-b-2xl">
          <button
            onClick={onClose}
            className="w-full py-3 px-4 bg-gray-900 text-white rounded-lg font-medium hover:bg-gray-800 transition-colors"
          >
            Close
          </button>
        </div>
      </div>
    </div>
  );
}
