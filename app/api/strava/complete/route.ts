import { NextRequest, NextResponse } from 'next/server';
import { getOAuthState, deleteOAuthState } from '@/lib/db/oauthState';
import { saveStravaConnection } from '@/lib/db/strava';
import { getUserId } from '@/lib/auth/getSession';
import { logger } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Complete Strava OAuth connection after user logs in
 * This handles the case where OAuth callback happened before user was logged in
 */
export async function GET(request: NextRequest) {
  try {
    const state = request.nextUrl.searchParams.get('state');
    
    if (!state) {
      return NextResponse.redirect('/settings?error=missing_state');
    }

    // Get user ID (should be logged in now)
    const userId = await getUserId();
    
    if (!userId) {
      return NextResponse.redirect('/auth/signin?error=login_required');
    }

    // Retrieve stored OAuth state
    const oauthState = await getOAuthState(state);
    
    if (!oauthState) {
      return NextResponse.redirect('/settings?error=oauth_state_expired');
    }

    // Check if we have token data stored
    if (!oauthState.access_token || !oauthState.athlete_id) {
      return NextResponse.redirect('/settings?error=incomplete_oauth_data');
    }

    // Save Strava connection
    try {
      await saveStravaConnection({
        athleteId: oauthState.athlete_id,
        accessToken: oauthState.access_token,
        refreshToken: oauthState.refresh_token || undefined,
        tokenExpiresAt: oauthState.token_expires_at 
          ? new Date(oauthState.token_expires_at)
          : undefined,
      }, userId);

      // Clean up OAuth state
      await deleteOAuthState(state);

      return NextResponse.redirect('/settings?connected=true');
    } catch (error) {
      logger.error('Failed to save Strava connection:', error);
      return NextResponse.redirect('/settings?error=connection_failed');
    }
  } catch (error) {
    logger.error('Error completing Strava OAuth:', error);
    return NextResponse.redirect('/settings?error=unexpected_error');
  }
}
