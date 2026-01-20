import { query, queryOne } from './client';

export interface GoalRow {
  id: string;
  user_id: string | null;
  race_name: string | null;
  race_date_iso: string;
  distance_mi: number;
  target_time_minutes: number;
  created_at: string;
  updated_at: string;
}

/**
 * Get goal for a user (or default user for now)
 */
export async function getGoal(userId?: string): Promise<GoalRow | null> {
  // For now, get the most recent goal (single user)
  // TODO: Add proper user authentication
  const sql = userId
    ? `SELECT * FROM goals WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`
    : `SELECT * FROM goals ORDER BY updated_at DESC LIMIT 1`;
  
  const params = userId ? [userId] : [];
  return queryOne<GoalRow>(sql, params);
}

/**
 * Save or update goal
 */
export async function saveGoal(
  goal: {
    raceName?: string;
    raceDateISO: string;
    distanceMi: number;
    targetTimeMinutes: number;
  },
  userId?: string
): Promise<GoalRow> {
  // For now, use a default user_id or create one
  // TODO: Add proper user authentication
  const defaultUserId = userId || '00000000-0000-0000-0000-000000000000';
  
  // Check if goal exists
  const existing = await getGoal(defaultUserId);
  
  if (existing) {
    // Update existing goal
    const sql = `
      UPDATE goals 
      SET 
        race_name = $1,
        race_date_iso = $2,
        distance_mi = $3,
        target_time_minutes = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;
    const result = await queryOne<GoalRow>(sql, [
      goal.raceName || null,
      goal.raceDateISO,
      goal.distanceMi,
      goal.targetTimeMinutes,
      existing.id,
    ]);
    
    if (!result) {
      throw new Error('Failed to update goal');
    }
    
    return result;
  } else {
    // Insert new goal
    const sql = `
      INSERT INTO goals (user_id, race_name, race_date_iso, distance_mi, target_time_minutes)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await queryOne<GoalRow>(sql, [
      defaultUserId,
      goal.raceName || null,
      goal.raceDateISO,
      goal.distanceMi,
      goal.targetTimeMinutes,
    ]);
    
    if (!result) {
      throw new Error('Failed to create goal');
    }
    
    return result;
  }
}
