import { query, queryOne } from './client';

export interface OAuthStateRow {
  id: string;
  state_token: string;
  code: string | null;
  access_token: string | null;
  refresh_token: string | null;
  athlete_id: number | null;
  token_expires_at: string | null;
  created_at: string;
  expires_at: string;
}

/**
 * Store OAuth state temporarily (for handling expired sessions)
 */
export async function storeOAuthState(
  stateToken: string,
  code?: string,
  tokenData?: {
    accessToken: string;
    refreshToken: string;
    athleteId: number;
    expiresAt: Date;
  }
): Promise<void> {
  const expiresAt = new Date();
  expiresAt.setMinutes(expiresAt.getMinutes() + 10); // 10 minute expiry

  await query`
    INSERT INTO oauth_states (state_token, code, access_token, refresh_token, athlete_id, token_expires_at, expires_at)
    VALUES (
      ${stateToken},
      ${code || null},
      ${tokenData?.accessToken || null},
      ${tokenData?.refreshToken || null},
      ${tokenData?.athleteId || null},
      ${tokenData?.expiresAt?.toISOString() || null},
      ${expiresAt.toISOString()}
    )
    ON CONFLICT (state_token) 
    DO UPDATE SET
      code = ${code || null},
      access_token = ${tokenData?.accessToken || null},
      refresh_token = ${tokenData?.refreshToken || null},
      athlete_id = ${tokenData?.athleteId || null},
      token_expires_at = ${tokenData?.expiresAt?.toISOString() || null},
      expires_at = ${expiresAt.toISOString()}
  `;
}

/**
 * Get OAuth state by token
 */
export async function getOAuthState(stateToken: string): Promise<OAuthStateRow | null> {
  const state = await queryOne<OAuthStateRow>`
    SELECT * FROM oauth_states
    WHERE state_token = ${stateToken}
      AND expires_at > NOW()
  `;
  
  return state || null;
}

/**
 * Delete OAuth state after use
 */
export async function deleteOAuthState(stateToken: string): Promise<void> {
  await query`
    DELETE FROM oauth_states
    WHERE state_token = ${stateToken}
  `;
}

/**
 * Clean up expired states (call periodically)
 */
export async function cleanupExpiredStates(): Promise<void> {
  await query`
    DELETE FROM oauth_states
    WHERE expires_at < NOW()
  `;
}
