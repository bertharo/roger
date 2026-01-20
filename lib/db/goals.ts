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
  if (userId) {
    return queryOne<GoalRow>`
      SELECT * FROM goals 
      WHERE user_id = ${userId} 
      ORDER BY updated_at DESC 
      LIMIT 1
    `;
  } else {
    return queryOne<GoalRow>`
      SELECT * FROM goals 
      ORDER BY updated_at DESC 
      LIMIT 1
    `;
  }
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
  // For now, use NULL user_id (single user app)
  // The schema allows NULL user_id, so we don't need a foreign key
  // TODO: Add proper user authentication
  
  // Check if goal exists (by checking if any goal exists, since we're single user)
  const existing = await getGoal();
  
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
    // Insert new goal with NULL user_id (single user app)
    const result = await queryOne<GoalRow>`
      INSERT INTO goals (user_id, race_name, race_date_iso, distance_mi, target_time_minutes)
      VALUES (NULL, ${goal.raceName || null}, ${goal.raceDateISO}, ${goal.distanceMi}, ${goal.targetTimeMinutes})
      RETURNING *
    `;
    
    if (!result) {
      throw new Error('Failed to create goal');
    }
    
    return result;
  }
}
