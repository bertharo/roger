/**
 * Format pace in min:sec per mile
 */
export function formatPace(minutesPerMile: number): string {
  const minutes = Math.floor(minutesPerMile);
  const seconds = Math.round((minutesPerMile - minutes) * 60);
  return `${minutes}:${seconds.toString().padStart(2, '0')}`;
}

/**
 * Format pace range
 */
export function formatPaceRange(range: [number, number]): string {
  return `${formatPace(range[0])}–${formatPace(range[1])}`;
}

/**
 * Format time in minutes to "Xh Ym" or "Ym"
 */
export function formatTime(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const mins = Math.round(minutes % 60);
  if (hours > 0) {
    return `${hours}h ${mins}m`;
  }
  return `${mins}m`;
}

/**
 * Calculate days between two dates
 */
export function daysBetween(date1ISO: string, date2ISO: string): number {
  const d1 = new Date(date1ISO);
  const d2 = new Date(date2ISO);
  const diffTime = d2.getTime() - d1.getTime();
  return Math.ceil(diffTime / (1000 * 60 * 60 * 24));
}

/**
 * Format day label from date
 */
export function getDayLabel(dateISO: string): string {
  const date = new Date(dateISO);
  const days = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
  return days[date.getDay()];
}

/**
 * Format distance in miles to 1 decimal place
 */
export function formatDistance(miles: number): string {
  return Math.round(miles * 10) / 10 + '';
}
