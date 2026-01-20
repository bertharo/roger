import { NextRequest } from 'next/server';

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
  const redirectUri = process.env.STRAVA_REDIRECT_URI || 'http://localhost:3000/api/strava/callback';
  
  if (!clientId) {
    return Response.json(
      { error: 'Strava client ID not configured. Add STRAVA_CLIENT_ID to .env' },
      { status: 500 }
    );
  }

  // Strava OAuth authorization URL
  const authUrl = `https://www.strava.com/oauth/authorize?` +
    `client_id=${clientId}&` +
    `response_type=code&` +
    `redirect_uri=${encodeURIComponent(redirectUri)}&` +
    `scope=activity:read_all&` +
    `approval_prompt=force`;

  // Redirect user to Strava
  return Response.redirect(authUrl);
}
