'use client';

import { useState } from 'react';
import { FitnessAssessment } from '@/lib/types';
import { FitnessAssessment as FitnessAssessmentComponent } from './FitnessAssessment';

interface FitnessAssessmentPromptProps {
  onComplete: (assessment: FitnessAssessment) => void;
  onDismiss: () => void;
}

export function FitnessAssessmentPrompt({ onComplete, onDismiss }: FitnessAssessmentPromptProps) {
  const [showAssessment, setShowAssessment] = useState(false);

  if (showAssessment) {
    return (
      <FitnessAssessmentComponent
        onComplete={(assessment) => {
          onComplete(assessment);
          setShowAssessment(false);
        }}
        onSkip={() => {
          onDismiss();
          setShowAssessment(false);
        }}
      />
    );
  }

  return (
    <div className="mx-4 mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
      <div className="flex items-start gap-3">
        <div className="flex-shrink-0">
          <svg className="w-5 h-5 text-blue-600" fill="none" viewBox="0 0 24 24" stroke="currentColor">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
          </svg>
        </div>
        <div className="flex-1">
          <h3 className="text-sm font-semibold text-blue-900 mb-1">
            Get a Personalized Plan
          </h3>
          <p className="text-xs text-blue-800 mb-3">
            Since you're not connected to Strava, help us understand your fitness level so we can create a training plan tailored to you.
          </p>
          <div className="flex gap-2">
            <button
              onClick={() => setShowAssessment(true)}
              className="px-3 py-1.5 text-xs font-medium text-white bg-blue-600 rounded-lg hover:bg-blue-700 transition-colors"
            >
              Start Assessment
            </button>
            <button
              onClick={onDismiss}
              className="px-3 py-1.5 text-xs font-medium text-blue-700 bg-blue-100 rounded-lg hover:bg-blue-200 transition-colors"
            >
              Maybe Later
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
