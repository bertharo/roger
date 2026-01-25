/**
 * Get the Monday of the week containing the given date
 * Week starts Monday (0) and ends Sunday (6)
 */
export function getMondayOfWeek(date: Date): Date {
  const d = new Date(date);
  d.setHours(0, 0, 0, 0);
  const day = d.getDay(); // 0 = Sunday, 1 = Monday, ..., 6 = Saturday
  const diff = d.getDate() - day + (day === 0 ? -6 : 1); // Adjust when day is Sunday
  return new Date(d.setDate(diff));
}

/**
 * Get the Sunday of the week containing the given date
 */
export function getSundayOfWeek(date: Date): Date {
  const monday = getMondayOfWeek(date);
  const sunday = new Date(monday);
  sunday.setDate(monday.getDate() + 6);
  sunday.setHours(23, 59, 59, 999);
  return sunday;
}

/**
 * Check if a date falls within a Monday-Sunday week
 */
export function isDateInWeek(date: Date, weekStart: Date): boolean {
  const monday = getMondayOfWeek(weekStart);
  const sunday = getSundayOfWeek(monday);
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  return checkDate >= monday && checkDate <= sunday;
}

/**
 * Get the week index (0-based) for a given date in a list of weekly plans
 */
export function getWeekIndexForDate(date: Date, weekStarts: string[]): number | null {
  const checkDate = new Date(date);
  checkDate.setHours(0, 0, 0, 0);
  
  for (let i = 0; i < weekStarts.length; i++) {
    const weekStart = new Date(weekStarts[i]);
    if (isDateInWeek(checkDate, weekStart)) {
      return i;
    }
  }
  
  return null;
}
