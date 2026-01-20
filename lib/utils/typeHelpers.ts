import { Run } from '../types';

/**
 * Validate and cast run type from JSON data
 */
export function castRunType(type: string | undefined): Run['type'] {
  const validTypes: Run['type'][] = ['easy', 'tempo', 'interval', 'long', 'race', 'recovery'];
  if (type && validTypes.includes(type as Run['type'])) {
    return type as Run['type'];
  }
  return undefined;
}

/**
 * Cast mock data runs to Run type
 */
export function castMockRuns(runs: any[]): Run[] {
  return runs.map(run => ({
    id: run.id,
    date: run.date,
    distanceMiles: run.distanceMiles,
    durationSeconds: run.durationSeconds,
    averagePaceMinPerMile: run.averagePaceMinPerMile,
    type: castRunType(run.type),
    elevationFeet: run.elevationFeet,
    notes: run.notes,
    effort: run.effort,
  }));
}
