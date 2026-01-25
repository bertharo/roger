import { getStravaConnection, saveStravaConnection } from '@/lib/db/strava';
import { queryOne } from '@/lib/db/client';

export interface StravaTokenResponse {
  access_token: string;
  refresh_token: string;
  expires_at: number; // Unix timestamp
  expires_in: number; // Seconds until expiration
}

/**
 * Refresh Strava access token using refresh token
 */
export async function refreshStravaToken(userId: string): Promise<{
  accessToken: string;
  refreshToken: string;
  expiresAt: Date;
} | null> {
  const connection = await getStravaConnection(userId);
  
  if (!connection || !connection.refresh_token) {
    return null;
  }
  
  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  
  if (!clientId || !clientSecret) {
    throw new Error('Strava credentials not configured');
  }
  
  try {
    const response = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        grant_type: 'refresh_token',
        refresh_token: connection.refresh_token,
      }),
    });
    
    if (!response.ok) {
      const errorText = await response.text();
      console.error('Token refresh failed:', {
        status: response.status,
        error: errorText,
      });
      return null;
    }
    
    const tokenData: StravaTokenResponse = await response.json();
    
    // Calculate expiration date
    const expiresAt = new Date(tokenData.expires_at * 1000);
    
    // Save refreshed tokens (this updates updated_at timestamp)
    await saveStravaConnection(
      {
        athleteId: connection.athlete_id,
        accessToken: tokenData.access_token,
        refreshToken: tokenData.refresh_token,
        tokenExpiresAt: expiresAt,
      },
      userId
    );
    
    // Note: updated_at is automatically set by the database, which serves as last sync time
    
    return {
      accessToken: tokenData.access_token,
      refreshToken: tokenData.refresh_token,
      expiresAt,
    };
  } catch (error) {
    console.error('Error refreshing Strava token:', error);
    return null;
  }
}

/**
 * Get valid access token, refreshing if necessary
 */
export async function getValidAccessToken(userId: string): Promise<string | null> {
  const connection = await getStravaConnection(userId);
  
  if (!connection || !connection.access_token) {
    return null;
  }
  
  // Check if token is expired or will expire soon (within 5 minutes)
  const isExpired = connection.token_expires_at 
    ? new Date(connection.token_expires_at) < new Date(Date.now() + 5 * 60 * 1000)
    : true; // If no expiration date, assume expired
  
  if (isExpired) {
    // Try to refresh
    const refreshed = await refreshStravaToken(userId);
    if (refreshed) {
      return refreshed.accessToken;
    }
    // If refresh failed, return null
    return null;
  }
  
  return connection.access_token;
}
