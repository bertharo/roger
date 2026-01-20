import { query, queryOne } from './client';

export interface StravaConnectionRow {
  id: string;
  user_id: string | null;
  athlete_id: number;
  access_token: string;
  refresh_token: string | null;
  token_expires_at: string | null;
  created_at: string;
  updated_at: string;
}

/**
 * Get Strava connection for a user
 */
export async function getStravaConnection(userId?: string): Promise<StravaConnectionRow | null> {
  // For now, get the most recent connection (single user)
  // TODO: Add proper user authentication
  const sql = userId
    ? `SELECT * FROM strava_connections WHERE user_id = $1 ORDER BY updated_at DESC LIMIT 1`
    : `SELECT * FROM strava_connections ORDER BY updated_at DESC LIMIT 1`;
  
  const params = userId ? [userId] : [];
  return queryOne<StravaConnectionRow>(sql, params);
}

/**
 * Save or update Strava connection
 */
export async function saveStravaConnection(
  connection: {
    athleteId: number;
    accessToken: string;
    refreshToken?: string;
    tokenExpiresAt?: Date;
  },
  userId?: string
): Promise<StravaConnectionRow> {
  // For now, use a default user_id or create one
  // TODO: Add proper user authentication
  const defaultUserId = userId || '00000000-0000-0000-0000-000000000000';
  
  // Check if connection exists
  const existing = await getStravaConnection(defaultUserId);
  
  if (existing) {
    // Update existing connection
    const sql = `
      UPDATE strava_connections 
      SET 
        athlete_id = $1,
        access_token = $2,
        refresh_token = $3,
        token_expires_at = $4,
        updated_at = NOW()
      WHERE id = $5
      RETURNING *
    `;
    const result = await queryOne<StravaConnectionRow>(sql, [
      connection.athleteId,
      connection.accessToken,
      connection.refreshToken || null,
      connection.tokenExpiresAt?.toISOString() || null,
      existing.id,
    ]);
    
    if (!result) {
      throw new Error('Failed to update Strava connection');
    }
    
    return result;
  } else {
    // Insert new connection
    const sql = `
      INSERT INTO strava_connections (user_id, athlete_id, access_token, refresh_token, token_expires_at)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING *
    `;
    const result = await queryOne<StravaConnectionRow>(sql, [
      defaultUserId,
      connection.athleteId,
      connection.accessToken,
      connection.refreshToken || null,
      connection.tokenExpiresAt?.toISOString() || null,
    ]);
    
    if (!result) {
      throw new Error('Failed to create Strava connection');
    }
    
    return result;
  }
}

/**
 * Delete Strava connection
 */
export async function deleteStravaConnection(userId?: string): Promise<void> {
  const defaultUserId = userId || '00000000-0000-0000-0000-000000000000';
  const sql = `DELETE FROM strava_connections WHERE user_id = $1`;
  await query(sql, [defaultUserId]);
}
