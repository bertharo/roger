import { FitnessAssessment, Run } from '../types';

/**
 * Convert a fitness assessment into synthetic runs that can be used
 * by the plan generator. This creates realistic recent run history
 * based on the user's self-reported fitness level.
 */
export function assessmentToRuns(assessment: FitnessAssessment): Run[] {
  const runs: Run[] = [];
  const now = new Date();
  
  // Generate runs for the past 2-3 weeks (most recent 5-10 runs)
  const numRuns = Math.min(assessment.daysPerWeek * 2, 10);
  const avgMilesPerRun = assessment.weeklyMileage / assessment.daysPerWeek;
  
  // Determine easy pace based on assessment
  let easyPace: number;
  if (assessment.easyPaceMinPerMile) {
    easyPace = assessment.easyPaceMinPerMile;
  } else {
    // Estimate based on fitness level and goal
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
  
  // Generate runs going back in time
  let daysAgo = 0;
  let runCount = 0;
  
  while (runCount < numRuns && daysAgo < 21) {
    // Skip some days to match daysPerWeek pattern
    const dayOfWeek = (now.getDay() - (daysAgo % 7) + 7) % 7;
    const shouldRun = Math.random() < (assessment.daysPerWeek / 7);
    
    if (shouldRun || runCount === 0) {
      const runDate = new Date(now);
      runDate.setDate(runDate.getDate() - daysAgo);
      runDate.setHours(8 + Math.floor(Math.random() * 4), 0, 0, 0); // Random morning time
      
      // Determine run type and distance
      let runType: Run['type'] = 'easy';
      let distance: number;
      
      // Mix of run types based on fitness level
      const rand = Math.random();
      if (assessment.fitnessLevel === 'advanced' && rand < 0.2) {
        runType = 'tempo';
        distance = avgMilesPerRun * 0.8;
      } else if (assessment.fitnessLevel !== 'beginner' && rand < 0.1) {
        runType = 'interval';
        distance = avgMilesPerRun * 0.7;
      } else if (rand < 0.15 && assessment.longestRunMiles) {
        // Occasional longer run
        runType = 'long';
        distance = Math.min(assessment.longestRunMiles * 0.9, avgMilesPerRun * 1.5);
      } else {
        runType = 'easy';
        distance = avgMilesPerRun * (0.8 + Math.random() * 0.4); // 80-120% of average
      }
      
      // Adjust pace based on run type
      let pace = easyPace;
      if (runType === 'tempo') {
        pace = easyPace - 1.0; // Tempo is faster
      } else if (runType === 'interval') {
        pace = easyPace - 1.5; // Intervals are faster
      } else if (runType === 'long') {
        pace = easyPace + 0.5; // Long runs are slower
      }
      
      // Add some variation
      pace += (Math.random() - 0.5) * 0.5;
      pace = Math.max(5.0, Math.min(14.0, pace)); // Clamp to reasonable range
      
      const durationSeconds = Math.round(distance * pace * 60);
      
      runs.push({
        id: `synthetic-${runCount}`,
        date: runDate.toISOString(),
        distanceMiles: Math.round(distance * 10) / 10,
        durationSeconds,
        averagePaceMinPerMile: Math.round(pace * 10) / 10,
        type: runType,
      });
      
      runCount++;
    }
    
    daysAgo++;
  }
  
  // Sort by date, most recent first
  return runs.sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime());
}
