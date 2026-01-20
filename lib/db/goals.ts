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
 * Get goal for a user
 */
export async function getGoal(userId: string | null): Promise<GoalRow | null> {
  if (!userId) {
    return null;
  }

  return queryOne<GoalRow>`
    SELECT * FROM goals 
    WHERE user_id = ${userId} 
    ORDER BY updated_at DESC 
    LIMIT 1
  `;
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
  userId: string
): Promise<GoalRow> {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  // Check if goal exists for this user
  const existing = await getGoal(userId);
  
  if (existing) {
    // Update existing goal
    const result = await queryOne<GoalRow>`
      UPDATE goals 
      SET 
        race_name = ${goal.raceName || null},
        race_date_iso = ${goal.raceDateISO},
        distance_mi = ${goal.distanceMi},
        target_time_minutes = ${goal.targetTimeMinutes},
        updated_at = NOW()
      WHERE id = ${existing.id}
      RETURNING *
    `;
    
    if (!result) {
      throw new Error('Failed to update goal');
    }
    
    return result;
  } else {
    // Insert new goal
    const result = await queryOne<GoalRow>`
      INSERT INTO goals (user_id, race_name, race_date_iso, distance_mi, target_time_minutes)
      VALUES (${userId}, ${goal.raceName || null}, ${goal.raceDateISO}, ${goal.distanceMi}, ${goal.targetTimeMinutes})
      RETURNING *
    `;
    
    if (!result) {
      throw new Error('Failed to create goal');
    }
    
    return result;
  }
}
