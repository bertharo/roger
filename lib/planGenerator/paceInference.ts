import { Run, PaceProfile, Goal, FitnessAssessment } from '../types';

/**
 * Calculate goal pace from target time and distance
 */
export function calculateGoalPace(goal: Goal): number {
  return goal.targetTimeMinutes / goal.distance;
}

/**
 * Infer pace profile from the most recent 3-5 runs or fitness assessment.
 * This determines easy pace range and threshold pace.
 * Now also considers goal pace for progressive training.
 */
export function inferPaceProfile(runs: Run[], goal?: Goal, assessment?: FitnessAssessment): PaceProfile {
  // Sort by date, most recent first
  const sortedRuns = [...runs].sort(
    (a, b) => new Date(b.date).getTime() - new Date(a.date).getTime()
  );
  
  // Use most recent 3-5 runs
  const recentRuns = sortedRuns.slice(0, 5);
  
  if (recentRuns.length === 0) {
    // Use assessment data if available
    if (assessment) {
      let easyPace: number;
      
      if (assessment.easyPaceMinPerMile) {
        easyPace = assessment.easyPaceMinPerMile;
      } else {
        // Estimate based on fitness level
        switch (assessment.fitnessLevel) {
          case 'beginner':
            easyPace = 10.0 + (assessment.weeklyMileage < 10 ? 1.5 : 0);
            break;
          case 'intermediate':
            easyPace = 8.5 + (assessment.weeklyMileage < 20 ? 0.5 : 0);
            break;
          case 'advanced':
            easyPace = 7.0 + (assessment.weeklyMileage < 30 ? 0.5 : 0);
            break;
        }
      }
      
      // Adjust based on recent running experience
      if (assessment.recentRunningExperience === 'none') {
        easyPace += 1.5;
      } else if (assessment.recentRunningExperience === 'some') {
        easyPace += 0.5;
      }
      
      // Clamp to reasonable range
      easyPace = Math.max(7.0, Math.min(14.0, easyPace));
      
      const easyPaceRange: [number, number] = [
        Math.round(easyPace * 10) / 10,
        Math.round((easyPace + 0.5) * 10) / 10,
      ];
      
      // Calculate threshold pace from easy pace
      const thresholdPace = Math.max(5.0, Math.min(12.0, easyPace - 0.75));
      
      // Adjust threshold toward goal pace if goal provided
      if (goal) {
        const goalPace = calculateGoalPace(goal);
        if (goalPace < thresholdPace) {
          // Goal is faster - start closer to current fitness but acknowledge goal
          const adjustedThreshold = Math.max(goalPace + 0.3, thresholdPace * 0.95);
          return {
            easyPaceRange,
            thresholdPace: Math.round(adjustedThreshold * 10) / 10,
            fitnessTrend: 'stable',
          };
        }
      }
      
      return {
        easyPaceRange,
        thresholdPace: Math.round(thresholdPace * 10) / 10,
        fitnessTrend: 'stable',
      };
    }
    
    // Default conservative paces if no data and no assessment
    return {
      easyPaceRange: [9.0, 10.0],
      thresholdPace: 8.0,
      fitnessTrend: 'stable',
    };
  }
  
  // Separate runs by type
  const easyRuns = recentRuns.filter(
    r => r.type === 'easy' || r.type === 'recovery'
  );
  const tempoRuns = recentRuns.filter(r => r.type === 'tempo');
  const intervalRuns = recentRuns.filter(r => r.type === 'interval');
  const allPaces = recentRuns.map(r => r.averagePaceMinPerMile);
  
  // Calculate easy pace range
  let easyPaceRange: [number, number];
  if (easyRuns.length >= 2) {
    const easyPaces = easyRuns.map(r => r.averagePaceMinPerMile);
    const avgEasy = easyPaces.reduce((a, b) => a + b, 0) / easyPaces.length;
    const minEasy = Math.min(...easyPaces);
    const maxEasy = Math.max(...easyPaces);
    easyPaceRange = [
      Math.max(5.0, Math.min(14.0, avgEasy - 0.3)),
      Math.max(5.0, Math.min(14.0, avgEasy + 0.5)),
    ];
  } else {
    // Infer from all runs: easy should be slower than average
    const avgPace = allPaces.reduce((a, b) => a + b, 0) / allPaces.length;
    easyPaceRange = [
      Math.max(5.0, Math.min(14.0, avgPace + 1.0)),
      Math.max(5.0, Math.min(14.0, avgPace + 2.0)),
    ];
  }
  
  // Calculate threshold pace
  let thresholdPace: number;
  if (tempoRuns.length >= 1) {
    const tempoPaces = tempoRuns.map(r => r.averagePaceMinPerMile);
    thresholdPace = tempoPaces.reduce((a, b) => a + b, 0) / tempoPaces.length;
  } else if (intervalRuns.length >= 1) {
    // Threshold is slower than intervals
    const intervalPaces = intervalRuns.map(r => r.averagePaceMinPerMile);
    const avgInterval = intervalPaces.reduce((a, b) => a + b, 0) / intervalPaces.length;
    thresholdPace = avgInterval + 0.5;
  } else {
    // Estimate from easy pace: threshold is ~30-45s faster per mile
    const avgEasy = (easyPaceRange[0] + easyPaceRange[1]) / 2;
    thresholdPace = Math.max(5.0, Math.min(12.0, avgEasy - 0.75));
  }
  
  // If goal is provided, adjust threshold pace toward goal pace
  // Threshold should be faster than goal pace (goal pace is race pace)
  if (goal) {
    const goalPace = calculateGoalPace(goal);
    // Threshold pace should be between current threshold and goal pace
    // If goal pace is much faster, we need to work toward it
    if (goalPace < thresholdPace) {
      // Goal is faster - blend current fitness with goal
      // Start closer to current, but acknowledge the goal
      thresholdPace = Math.max(goalPace + 0.3, thresholdPace * 0.95);
    }
  }
  
  // Determine fitness trend
  const fitnessTrend = calculateFitnessTrend(recentRuns);
  
  return {
    easyPaceRange: [
      Math.round(easyPaceRange[0] * 10) / 10,
      Math.round(easyPaceRange[1] * 10) / 10,
    ],
    thresholdPace: Math.round(thresholdPace * 10) / 10,
    fitnessTrend,
  };
}

function calculateFitnessTrend(runs: Run[]): 'improving' | 'stable' | 'declining' {
  if (runs.length < 3) return 'stable';
  
  // Compare most recent 2 runs to previous 2 runs
  const recent2 = runs.slice(0, 2);
  const previous2 = runs.slice(2, 4);
  
  if (previous2.length < 2) return 'stable';
  
  const recentAvgPace = recent2.reduce((sum, r) => sum + r.averagePaceMinPerMile, 0) / recent2.length;
  const previousAvgPace = previous2.reduce((sum, r) => sum + r.averagePaceMinPerMile, 0) / previous2.length;
  
  const paceDiff = recentAvgPace - previousAvgPace;
  
  // Faster pace (lower number) = improving
  if (paceDiff < -0.2) return 'improving';
  if (paceDiff > 0.2) return 'declining';
  return 'stable';
}
