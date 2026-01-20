import { validateCoachResponse, validatePredictedTime } from '@/lib/coachEngine/validator';

describe('Coach Response Validator', () => {
  describe('validateCoachResponse', () => {
    it('should validate and sanitize a valid response', () => {
      const input = {
        assistantMessage: 'Test message',
        recommendedNextRun: {
          type: 'easy',
          distanceMiles: 5.0,
          paceRangeMinPerMile: [8.0, 9.0],
          notes: 'Easy run',
        },
        kpis: {
          daysToGoal: 42,
          weeklyMiles7d: 25.5,
          predictedTimeMinutes: 95,
          confidence: 'medium',
        },
      };

      const result = validateCoachResponse(input);

      expect(result.assistantMessage).toBe('Test message');
      expect(result.recommendedNextRun.type).toBe('easy');
      expect(result.recommendedNextRun.distanceMiles).toBe(5.0);
      expect(result.recommendedNextRun.paceRangeMinPerMile).toEqual([8.0, 9.0]);
      expect(result.kpis.daysToGoal).toBe(42);
    });

    it('should clamp distance to 0-30 range', () => {
      const input = {
        assistantMessage: 'Test',
        recommendedNextRun: {
          type: 'easy',
          distanceMiles: 50, // Too high
          paceRangeMinPerMile: [8.0, 9.0],
          notes: '',
        },
        kpis: {
          daysToGoal: 0,
          weeklyMiles7d: 0,
          predictedTimeMinutes: 0,
          confidence: 'low',
        },
      };

      const result = validateCoachResponse(input);
      expect(result.recommendedNextRun.distanceMiles).toBe(30);
    });

    it('should clamp pace range to valid bounds', () => {
      const input = {
        assistantMessage: 'Test',
        recommendedNextRun: {
          type: 'easy',
          distanceMiles: 5.0,
          paceRangeMinPerMile: [3.0, 20.0], // Out of bounds
          notes: '',
        },
        kpis: {
          daysToGoal: 0,
          weeklyMiles7d: 0,
          predictedTimeMinutes: 0,
          confidence: 'low',
        },
      };

      const result = validateCoachResponse(input);
      expect(result.recommendedNextRun.paceRangeMinPerMile[0]).toBeGreaterThanOrEqual(5.0);
      expect(result.recommendedNextRun.paceRangeMinPerMile[1]).toBeLessThanOrEqual(14.0);
    });

    it('should ensure pace range min <= max', () => {
      const input = {
        assistantMessage: 'Test',
        recommendedNextRun: {
          type: 'easy',
          distanceMiles: 5.0,
          paceRangeMinPerMile: [9.0, 8.0], // Reversed
          notes: '',
        },
        kpis: {
          daysToGoal: 0,
          weeklyMiles7d: 0,
          predictedTimeMinutes: 0,
          confidence: 'low',
        },
      };

      const result = validateCoachResponse(input);
      expect(result.recommendedNextRun.paceRangeMinPerMile[0]).toBeLessThanOrEqual(
        result.recommendedNextRun.paceRangeMinPerMile[1]
      );
    });

    it('should default invalid run type to easy', () => {
      const input = {
        assistantMessage: 'Test',
        recommendedNextRun: {
          type: 'invalid',
          distanceMiles: 5.0,
          paceRangeMinPerMile: [8.0, 9.0],
          notes: '',
        },
        kpis: {
          daysToGoal: 0,
          weeklyMiles7d: 0,
          predictedTimeMinutes: 0,
          confidence: 'low',
        },
      };

      const result = validateCoachResponse(input);
      expect(result.recommendedNextRun.type).toBe('easy');
    });
  });

  describe('validatePredictedTime', () => {
    it('should validate plausible predicted time', () => {
      const result = validatePredictedTime(95, 13.1); // Half marathon in 95 min = ~7.25 min/mi
      expect(result.isValid).toBe(true);
      expect(result.confidence).toBe('medium');
    });

    it('should flag implausible fast time', () => {
      const result = validatePredictedTime(30, 13.1); // Half marathon in 30 min = ~2.3 min/mi (impossible)
      expect(result.isValid).toBe(false);
      expect(result.adjusted).toBeDefined();
      expect(result.confidence).toBe('low');
    });

    it('should flag implausible slow time', () => {
      const result = validatePredictedTime(300, 13.1); // Half marathon in 300 min = ~23 min/mi (too slow)
      expect(result.isValid).toBe(false);
      expect(result.adjusted).toBeDefined();
      expect(result.confidence).toBe('low');
    });
  });
});
