'use client';

import { useState } from 'react';
import type { FitnessAssessment } from '@/lib/types';
import { showToast } from '@/lib/utils/toast';
import { logger } from '@/lib/utils/logger';

interface FitnessAssessmentProps {
  onComplete: (assessment: FitnessAssessment, savedSuccessfully: boolean) => void;
  onSkip?: () => void;
}

export function FitnessAssessment({ onComplete, onSkip }: FitnessAssessmentProps) {
  const [step, setStep] = useState(1);
  const [assessment, setAssessment] = useState<Partial<FitnessAssessment>>({
    fitnessLevel: 'beginner',
    weeklyMileage: 10,
    daysPerWeek: 3,
    recentRunningExperience: 'some',
  });

  const handleNext = () => {
    if (step < 5) {
      setStep(step + 1);
    } else {
      handleSubmit();
    }
  };

  const handleBack = () => {
    if (step > 1) {
      setStep(step - 1);
    }
  };

  const handleSubmit = async () => {
    if (!assessment.fitnessLevel || !assessment.weeklyMileage || !assessment.daysPerWeek || !assessment.recentRunningExperience) {
      showToast.error('Please answer all questions');
      return;
    }

    const completeAssessment: FitnessAssessment = {
      fitnessLevel: assessment.fitnessLevel,
      weeklyMileage: assessment.weeklyMileage,
      daysPerWeek: assessment.daysPerWeek,
      easyPaceMinPerMile: assessment.easyPaceMinPerMile,
      recentRunningExperience: assessment.recentRunningExperience,
      longestRunMiles: assessment.longestRunMiles,
      completedAt: new Date().toISOString(),
    };

    // Save to database
    let savedSuccessfully = false;
    try {
      const response = await fetch('/api/fitness-assessment', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(completeAssessment),
        credentials: 'include',
      });

      if (response.ok) {
        const result = await response.json();
        logger.info('Fitness assessment saved to database:', result);
        savedSuccessfully = true;
        // Also save to localStorage as backup
        localStorage.setItem('fitness_assessment', JSON.stringify(completeAssessment));
      } else {
        const errorData = await response.json().catch(() => ({}));
        logger.warn('Failed to save assessment to database:', errorData);
        localStorage.setItem('fitness_assessment', JSON.stringify(completeAssessment));
      }
    } catch (error) {
      logger.error('Error saving assessment:', error);
      localStorage.setItem('fitness_assessment', JSON.stringify(completeAssessment));
    }

    // Pass the saved status to the completion handler
    onComplete(completeAssessment, savedSuccessfully);
  };

  return (
    <div className="mx-auto max-w-md min-h-screen bg-white">
      <div className="px-4 py-6">
        {/* Progress indicator */}
        <div className="mb-6">
          <div className="flex justify-between text-xs text-gray-500 mb-2">
            <span>Step {step} of 5</span>
            <span>{Math.round((step / 5) * 100)}%</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-blue-500 h-1.5 rounded-full transition-all duration-300"
              style={{ width: `${(step / 5) * 100}%` }}
            />
          </div>
        </div>

        {/* Step 1: Fitness Level */}
        {step === 1 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              What's your current fitness level?
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              This helps us create a plan that matches your experience.
            </p>
            <div className="space-y-3">
              {(['beginner', 'intermediate', 'advanced'] as const).map((level) => (
                <button
                  key={level}
                  onClick={() => setAssessment({ ...assessment, fitnessLevel: level })}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    assessment.fitnessLevel === level
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900 capitalize mb-1">{level}</div>
                  <div className="text-xs text-gray-600">
                    {level === 'beginner' && 'New to running or returning after a long break'}
                    {level === 'intermediate' && 'Regular runner, comfortable with 3-5 mile runs'}
                    {level === 'advanced' && 'Experienced runner, comfortable with longer distances'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Weekly Mileage */}
        {step === 2 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              How many miles per week are you comfortable running?
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              This helps us set your starting weekly volume.
            </p>
            <div className="space-y-3">
              {[5, 10, 15, 20, 25, 30, 35, 40].map((miles) => (
                <button
                  key={miles}
                  onClick={() => setAssessment({ ...assessment, weeklyMileage: miles })}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    assessment.weeklyMileage === miles
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{miles} miles/week</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 3: Days Per Week */}
        {step === 3 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              How many days per week can you run?
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              We'll build your plan around your schedule.
            </p>
            <div className="space-y-3">
              {[3, 4, 5, 6, 7].map((days) => (
                <button
                  key={days}
                  onClick={() => setAssessment({ ...assessment, daysPerWeek: days })}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    assessment.daysPerWeek === days
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900">{days} days/week</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 4: Recent Experience */}
        {step === 4 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              How has your recent running been?
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              This helps us understand your current training base.
            </p>
            <div className="space-y-3">
              {(['none', 'some', 'regular'] as const).map((exp) => (
                <button
                  key={exp}
                  onClick={() => setAssessment({ ...assessment, recentRunningExperience: exp })}
                  className={`w-full text-left p-4 rounded-lg border-2 transition-all ${
                    assessment.recentRunningExperience === exp
                      ? 'border-blue-500 bg-blue-50'
                      : 'border-gray-200 hover:border-gray-300'
                  }`}
                >
                  <div className="font-medium text-gray-900 capitalize mb-1">
                    {exp === 'none' && 'Not running recently'}
                    {exp === 'some' && 'Running occasionally'}
                    {exp === 'regular' && 'Running consistently'}
                  </div>
                  <div className="text-xs text-gray-600">
                    {exp === 'none' && 'Starting fresh or returning after a break'}
                    {exp === 'some' && 'Running 1-2 times per week'}
                    {exp === 'regular' && 'Running 3+ times per week consistently'}
                  </div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 5: Optional Details */}
        {step === 5 && (
          <div>
            <h2 className="text-xl font-semibold text-gray-900 mb-2">
              A few more details (optional)
            </h2>
            <p className="text-sm text-gray-600 mb-6">
              These help us fine-tune your pace recommendations.
            </p>
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Easy run pace (minutes per mile) - if you know it
                </label>
                <input
                  type="number"
                  step="0.1"
                  min="5"
                  max="15"
                  value={assessment.easyPaceMinPerMile || ''}
                  onChange={(e) =>
                    setAssessment({
                      ...assessment,
                      easyPaceMinPerMile: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  placeholder="e.g., 8.5"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  Longest run recently (miles) - if applicable
                </label>
                <input
                  type="number"
                  step="0.5"
                  min="1"
                  max="30"
                  value={assessment.longestRunMiles || ''}
                  onChange={(e) =>
                    setAssessment({
                      ...assessment,
                      longestRunMiles: e.target.value ? parseFloat(e.target.value) : undefined,
                    })
                  }
                  placeholder="e.g., 6"
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>
            </div>
          </div>
        )}

        {/* Navigation buttons */}
        <div className="mt-8 flex gap-3">
          {step > 1 && (
            <button
              onClick={handleBack}
              className="flex-1 py-2.5 px-4 border border-gray-300 rounded-lg text-sm font-medium text-gray-700 hover:bg-gray-50 transition-colors"
            >
              Back
            </button>
          )}
          <button
            onClick={handleNext}
            className="flex-1 py-2.5 px-4 bg-blue-600 text-white rounded-lg text-sm font-medium hover:bg-blue-700 transition-colors"
          >
            {step === 5 ? 'Complete' : 'Next'}
          </button>
        </div>

        {onSkip && step === 1 && (
          <button
            onClick={onSkip}
            className="mt-4 w-full text-sm text-gray-500 hover:text-gray-700"
          >
            Skip for now
          </button>
        )}
      </div>
    </div>
  );
}
