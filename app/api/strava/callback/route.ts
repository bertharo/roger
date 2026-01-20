import { NextRequest } from 'next/server';

/**
 * Strava OAuth Callback Endpoint
 * 
 * This endpoint handles the OAuth callback from Strava.
 * It exchanges the authorization code for an access token.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const code = searchParams.get('code');
  const error = searchParams.get('error');

  if (error) {
    return Response.redirect('/settings?error=strava_auth_failed');
  }

  if (!code) {
    return Response.redirect('/settings?error=no_code');
  }

  const clientId = process.env.STRAVA_CLIENT_ID;
  const clientSecret = process.env.STRAVA_CLIENT_SECRET;
  const redirectUri = process.env.STRAVA_REDIRECT_URI || 'http://localhost:3000/api/strava/callback';

  if (!clientId || !clientSecret) {
    return Response.redirect('/settings?error=config_missing');
  }

  try {
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
      throw new Error('Failed to exchange code for token');
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, athlete } = tokenData;

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
    console.log('Strava connected:', {
      athleteId: athlete.id,
      athleteName: `${athlete.firstname} ${athlete.lastname}`,
    });

    // Redirect to settings page with success
    return Response.redirect('/settings?connected=true');
  } catch (error) {
    console.error('Strava OAuth error:', error);
    return Response.redirect('/settings?error=token_exchange_failed');
  }
}
