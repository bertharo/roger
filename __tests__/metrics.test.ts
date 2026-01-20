import {
  getWeeklyMiles,
  getDaysToGoal,
  getTrainingLoadTrend,
} from '@/lib/metrics';
import { Run, Goal } from '@/lib/types';

describe('Metrics Calculations', () => {
  const mockRuns: Run[] = [
    {
      id: '1',
      date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(), // 2 days ago
      distanceMiles: 5.0,
      durationSeconds: 2400,
      averagePaceMinPerMile: 8.0,
      type: 'easy',
    },
    {
      id: '2',
      date: new Date(Date.now() - 5 * 24 * 60 * 60 * 1000).toISOString(), // 5 days ago
      distanceMiles: 3.0,
      durationSeconds: 1440,
      averagePaceMinPerMile: 8.0,
      type: 'easy',
    },
    {
      id: '3',
      date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
      distanceMiles: 8.0,
      durationSeconds: 4320,
      averagePaceMinPerMile: 9.0,
      type: 'long',
    },
  ];

  describe('getWeeklyMiles', () => {
    it('should calculate weekly miles for last 7 days', () => {
      const result = getWeeklyMiles(mockRuns, 7);
      // Should include runs from 2 and 5 days ago = 5.0 + 3.0 = 8.0
      expect(result).toBe(8.0);
    });

    it('should calculate weekly miles for last 14 days', () => {
      const result = getWeeklyMiles(mockRuns, 14);
      // Should include all runs = 5.0 + 3.0 + 8.0 = 16.0
      expect(result).toBe(16.0);
    });

    it('should return 0 for empty runs array', () => {
      const result = getWeeklyMiles([], 7);
      expect(result).toBe(0);
    });
  });

  describe('getDaysToGoal', () => {
    it('should calculate days to goal correctly', () => {
      const goal: Goal = {
        raceDate: new Date(Date.now() + 42 * 24 * 60 * 60 * 1000).toISOString(), // 42 days from now
        distance: 13.1,
        targetTimeMinutes: 95,
      };

      const result = getDaysToGoal(goal);
      expect(result).toBe(42);
    });

    it('should return 0 if goal date is in the past', () => {
      const goal: Goal = {
        raceDate: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(), // 10 days ago
        distance: 13.1,
        targetTimeMinutes: 95,
      };

      const result = getDaysToGoal(goal);
      expect(result).toBe(0);
    });
  });

  describe('getTrainingLoadTrend', () => {
    it('should detect increasing trend', () => {
      const runs: Run[] = [
        {
          id: '1',
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          distanceMiles: 10.0,
          durationSeconds: 4800,
          averagePaceMinPerMile: 8.0,
        },
        {
          id: '2',
          date: new Date(Date.now() - 2 * 24 * 60 * 60 * 1000).toISOString(),
          distanceMiles: 8.0,
          durationSeconds: 3840,
          averagePaceMinPerMile: 8.0,
        },
        {
          id: '3',
          date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          distanceMiles: 3.0,
          durationSeconds: 1440,
          averagePaceMinPerMile: 8.0,
        },
      ];

      const result = getTrainingLoadTrend(runs);
      expect(result.trend).toBe('increasing');
      expect(result.last7d).toBe(18.0);
      expect(result.previous7d).toBe(3.0);
    });

    it('should detect stable trend', () => {
      const runs: Run[] = [
        {
          id: '1',
          date: new Date(Date.now() - 1 * 24 * 60 * 60 * 1000).toISOString(),
          distanceMiles: 5.0,
          durationSeconds: 2400,
          averagePaceMinPerMile: 8.0,
        },
        {
          id: '2',
          date: new Date(Date.now() - 10 * 24 * 60 * 60 * 1000).toISOString(),
          distanceMiles: 5.0,
          durationSeconds: 2400,
          averagePaceMinPerMile: 8.0,
        },
      ];

      const result = getTrainingLoadTrend(runs);
      expect(result.trend).toBe('stable');
    });
  });
});
