import { NextRequest, NextResponse } from 'next/server';
import { saveStravaConnection } from '@/lib/db/strava';
import { getUserId } from '@/lib/auth/getSession';

/**
 * Strava OAuth Callback Endpoint
 * 
 * This endpoint handles the OAuth callback from Strava.
 * It exchanges the authorization code for an access token.
 */
export async function GET(request: NextRequest) {
  try {
    const code = request.nextUrl.searchParams.get('code');
    const error = request.nextUrl.searchParams.get('error');

    // Get base URL for redirects
    const host = request.headers.get('host') || '';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    if (error) {
      console.error('Strava OAuth error from Strava:', error);
      return NextResponse.redirect(`${baseUrl}/settings?error=strava_auth_failed`);
    }

    if (!code) {
      console.error('No authorization code received from Strava');
      return NextResponse.redirect(`${baseUrl}/settings?error=no_code`);
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
      return NextResponse.redirect(`${baseUrl}/settings?error=config_missing`);
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
      return NextResponse.redirect(`${baseUrl}/settings?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, athlete } = tokenData;

    if (!access_token || !athlete) {
      console.error('Invalid token response from Strava:', tokenData);
      return NextResponse.redirect(`${baseUrl}/settings?error=invalid_token_response`);
    }

    // Get user ID from session
    const userId = await getUserId();
    
    if (!userId) {
      // User not logged in - redirect to sign in
      return NextResponse.redirect(`${baseUrl}/auth/signin?error=login_required&message=Please sign in to connect Strava`);
    }
    
    // Try to save to database
    try {
      // Calculate token expiration (Strava tokens typically expire in 6 hours)
      const tokenExpiresAt = new Date();
      tokenExpiresAt.setHours(tokenExpiresAt.getHours() + 6);
      
      await saveStravaConnection({
        athleteId: athlete.id,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt,
      }, userId);
      
      console.log('Strava connection saved to database for user:', userId);
    } catch (dbError) {
      console.error('Database save failed, falling back to cookies:', dbError);
      // Fallback to cookies if database fails
      const redirectResponse = NextResponse.redirect(`${baseUrl}/settings?connected=true`);
      
      redirectResponse.cookies.set('strava_access_token', access_token, {
        httpOnly: true,
        secure: process.env.NODE_ENV === 'production',
        sameSite: 'lax',
        maxAge: 60 * 60 * 24 * 30,
      });
      
      if (refresh_token) {
        redirectResponse.cookies.set('strava_refresh_token', refresh_token, {
          httpOnly: true,
          secure: process.env.NODE_ENV === 'production',
          sameSite: 'lax',
          maxAge: 60 * 60 * 24 * 365,
        });
      }
      
      return redirectResponse;
    }

    // Database save succeeded
    const redirectResponse = NextResponse.redirect(`${baseUrl}/settings?connected=true`);

    // Log success
    console.log('Strava connected successfully:', {
      athleteId: athlete.id,
      athleteName: `${athlete.firstname} ${athlete.lastname}`,
      hasAccessToken: !!access_token,
      hasRefreshToken: !!refresh_token,
    });

    return redirectResponse;
  } catch (error) {
    console.error('Unexpected error in Strava callback:', error);
    // Get base URL for error redirect
    const host = request.headers.get('host') || '';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    return NextResponse.redirect(`${baseUrl}/settings?error=unexpected_error`);
  }
}
