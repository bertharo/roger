import { NextRequest, NextResponse } from 'next/server';
import { storeOAuthState } from '@/lib/db/oauthState';
import crypto from 'crypto';

/**
 * Strava OAuth Connect Endpoint
 * 
 * This endpoint initiates the Strava OAuth flow.
 * 
 * Setup instructions:
 * 1. Create a Strava app at https://www.strava.com/settings/api
 * 2. Add to .env:
 *    STRAVA_CLIENT_ID=your_client_id
 *    STRAVA_CLIENT_SECRET=your_client_secret
 *    STRAVA_REDIRECT_URI=http://localhost:3000/api/strava/callback
 * 3. Update the redirect URI in your Strava app settings
 */
export async function GET(request: NextRequest) {
  const clientId = process.env.STRAVA_CLIENT_ID;
  
  // Determine redirect URI based on environment
  const host = request.headers.get('host') || '';
  const protocol = host.includes('localhost') ? 'http' : 'https';
  const redirectUri = process.env.STRAVA_REDIRECT_URI || 
    `${protocol}://${host}/api/strava/callback`;
  
  if (!clientId) {
    return Response.json(
      { error: 'Strava client ID not configured. Add STRAVA_CLIENT_ID to .env' },
      { status: 500 }
    );
  }

  // Generate state token for OAuth flow
  const stateToken = crypto.randomUUID();
  
  // Store state in database (for handling expired sessions)
  try {
    await storeOAuthState(stateToken);
  } catch (error) {
    console.error('Failed to store OAuth state, continuing anyway:', error);
  }

  // Strava OAuth authorization URL
  const authUrl = `https://www.strava.com/oauth/authorize?` +
    `client_id=${clientId}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=activity:read_all&` +
    `approval_prompt=force&` +
    `state=${stateToken}`;

  // Redirect user to Strava with state token
  const response = NextResponse.redirect(authUrl);
  
  // Also store in cookie as backup
  response.cookies.set('strava_oauth_state', stateToken, {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 60 * 10, // 10 minutes
  });

  return response;
}
