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
export async function getStravaConnection(userId: string | null): Promise<StravaConnectionRow | null> {
  if (!userId) {
    return null;
  }

  return queryOne<StravaConnectionRow>`
    SELECT * FROM strava_connections 
    WHERE user_id = ${userId} 
    ORDER BY updated_at DESC 
    LIMIT 1
  `;
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
  userId: string
): Promise<StravaConnectionRow> {
  if (!userId) {
    throw new Error('User ID is required');
  }
  
  // Check if connection exists for this user
  const existing = await getStravaConnection(userId);
  
  if (existing) {
    // Update existing connection
    const result = await queryOne<StravaConnectionRow>`
      UPDATE strava_connections 
      SET 
        athlete_id = ${connection.athleteId},
        access_token = ${connection.accessToken},
        refresh_token = ${connection.refreshToken || null},
        token_expires_at = ${connection.tokenExpiresAt?.toISOString() || null},
        updated_at = NOW()
      WHERE id = ${existing.id}
      RETURNING *
    `;
    
    if (!result) {
      throw new Error('Failed to update Strava connection');
    }
    
    return result;
  } else {
    // Insert new connection
    const result = await queryOne<StravaConnectionRow>`
      INSERT INTO strava_connections (user_id, athlete_id, access_token, refresh_token, token_expires_at)
      VALUES (${userId}, ${connection.athleteId}, ${connection.accessToken}, ${connection.refreshToken || null}, ${connection.tokenExpiresAt?.toISOString() || null})
      RETURNING *
    `;
    
    if (!result) {
      throw new Error('Failed to create Strava connection');
    }
    
    return result;
  }
}

/**
 * Delete Strava connection
 */
export async function deleteStravaConnection(userId: string): Promise<void> {
  if (!userId) {
    throw new Error('User ID is required');
  }

  await query`
    DELETE FROM strava_connections 
    WHERE user_id = ${userId}
  `;
}
