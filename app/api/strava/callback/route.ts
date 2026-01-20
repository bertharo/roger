import { NextRequest } from 'next/server';

/**
 * Strava OAuth Callback Endpoint
 * 
 * This endpoint handles the OAuth callback from Strava.
 * It exchanges the authorization code for an access token.
 */
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url);
    const code = searchParams.get('code');
    const error = searchParams.get('error');

    // Get base URL for redirects
    const host = request.headers.get('host') || '';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    if (error) {
      console.error('Strava OAuth error from Strava:', error);
      return Response.redirect(`${baseUrl}/settings?error=strava_auth_failed`);
    }

    if (!code) {
      console.error('No authorization code received from Strava');
      return Response.redirect(`${baseUrl}/settings?error=no_code`);
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    
    // Determine redirect URI based on environment
    const redirectUri = process.env.STRAVA_REDIRECT_URI || 
      `${baseUrl}/api/strava/callback`;

    if (!clientId || !clientSecret) {
      console.error('Missing Strava credentials:', {
        hasClientId: !!clientId,
        hasClientSecret: !!clientSecret,
      });
      return Response.redirect(`${baseUrl}/settings?error=config_missing`);
    }

    // Exchange authorization code for access token
    const tokenResponse = await fetch('https://www.strava.com/oauth/token', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        client_id: clientId,
        client_secret: clientSecret,
        code,
        grant_type: 'authorization_code',
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      console.error('Strava token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText,
      });
      return Response.redirect(`${baseUrl}/settings?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, athlete } = tokenData;

    if (!access_token || !athlete) {
      console.error('Invalid token response from Strava:', tokenData);
      return Response.redirect(`${baseUrl}/settings?error=invalid_token_response`);
    }

    // TODO: Store tokens securely in your database
    // Example:
    // await db.user.update({
    //   where: { id: session.userId },
    //   data: {
    //     stravaAccessToken: access_token,
    //     stravaRefreshToken: refresh_token,
    //     stravaAthleteId: athlete.id,
    //   },
    // });

    // For now, just log (in production, store in database)
    console.log('Strava connected successfully:', {
      athleteId: athlete.id,
      athleteName: `${athlete.firstname} ${athlete.lastname}`,
      hasAccessToken: !!access_token,
      hasRefreshToken: !!refresh_token,
    });

    // Redirect to settings page with success
    return Response.redirect(`${baseUrl}/settings?connected=true`);
  } catch (error) {
    console.error('Unexpected error in Strava callback:', error);
    // Get base URL for error redirect
    const host = request.headers.get('host') || '';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    return Response.redirect(`${baseUrl}/settings?error=unexpected_error`);
  }
}
