import { CoachResponse, RecommendedRun, KPIs } from '../types';

/**
 * Validate and sanitize coach response
 */
export function validateCoachResponse(response: any): CoachResponse {
  // Validate recommendedNextRun
  const recommendedRun: RecommendedRun = {
    type: validateRunType(response.recommendedNextRun?.type),
    distanceMiles: validateDistance(response.recommendedNextRun?.distanceMiles),
    paceRangeMinPerMile: validatePaceRange(response.recommendedNextRun?.paceRangeMinPerMile),
    notes: String(response.recommendedNextRun?.notes || ''),
  };
  
  // Validate KPIs
  const kpis: KPIs = {
    daysToGoal: Math.max(0, Math.round(Number(response.kpis?.daysToGoal) || 0)),
    weeklyMiles7d: Math.max(0, Number(response.kpis?.weeklyMiles7d) || 0),
    predictedTimeMinutes: Math.max(0, Number(response.kpis?.predictedTimeMinutes) || 0),
    confidence: validateConfidence(response.kpis?.confidence),
  };
  
  return {
    assistantMessage: String(response.assistantMessage || ''),
    recommendedNextRun: recommendedRun,
    kpis,
  };
}

function validateRunType(type: any): RecommendedRun['type'] {
  const validTypes: RecommendedRun['type'][] = ['easy', 'tempo', 'interval', 'long', 'rest'];
  if (validTypes.includes(type)) {
    return type;
  }
  return 'easy'; // default fallback
}

function validateDistance(distance: any): number {
  const dist = Number(distance);
  if (isNaN(dist) || dist < 0) {
    return 0;
  }
  if (dist > 30) {
    return 30;
  }
  return Math.round(dist * 10) / 10; // round to 1 decimal
}

function validatePaceRange(range: any): [number, number] {
  if (!Array.isArray(range) || range.length !== 2) {
    return [8.0, 9.0]; // conservative default
  }
  
  let [min, max] = range.map(Number);
  
  // Clamp to valid range [5.0, 14.0]
  min = Math.max(5.0, Math.min(14.0, min));
  max = Math.max(5.0, Math.min(14.0, max));
  
  // Ensure min <= max
  if (min > max) {
    const temp = min;
    min = max;
    max = temp;
  }
  
  // If they're equal, add a small range
  if (min === max) {
    max = Math.min(14.0, min + 0.5);
  }
  
  return [Math.round(min * 10) / 10, Math.round(max * 10) / 10];
}

function validateConfidence(confidence: any): KPIs['confidence'] {
  const validConfidences: KPIs['confidence'][] = ['low', 'medium', 'high'];
  if (validConfidences.includes(confidence)) {
    return confidence;
  }
  return 'low'; // default to low if uncertain
}

/**
 * Validate predicted time is plausible for distance
 */
export function validatePredictedTime(
  predictedTimeMinutes: number,
  distance: number
): { isValid: boolean; adjusted?: number; confidence: KPIs['confidence'] } {
  // Rough bounds: 5 min/mi to 15 min/mi
  const minPace = 5.0;
  const maxPace = 15.0;
  
  const pace = predictedTimeMinutes / distance;
  
  if (pace < minPace || pace > maxPace) {
    // Adjust to plausible range
    const adjusted = distance * Math.max(minPace, Math.min(maxPace, pace));
    return {
      isValid: false,
      adjusted: Math.round(adjusted),
      confidence: 'low',
    };
  }
  
  // Determine confidence based on how close to extremes
  let confidence: KPIs['confidence'] = 'medium';
  if (pace < 6.0 || pace > 12.0) {
    confidence = 'low';
  } else if (pace >= 7.0 && pace <= 10.0) {
    confidence = 'high';
  }
  
  return { isValid: true, confidence };
}
