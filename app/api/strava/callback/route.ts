import { NextRequest, NextResponse } from 'next/server';
import { saveStravaConnection } from '@/lib/db/strava';
import { getUserId } from '@/lib/auth/getSession';
import { getOAuthState, storeOAuthState, deleteOAuthState } from '@/lib/db/oauthState';
import { logger } from '@/lib/utils/logger';

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
    const state = request.nextUrl.searchParams.get('state');

    // Get base URL for redirects
    const host = request.headers.get('host') || '';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;

    if (error) {
      logger.error('Strava OAuth error from Strava:', error);
      // Check for quota limit error
      if (error.includes('403') || error.includes('quota') || error.includes('limit')) {
        return NextResponse.redirect(`${baseUrl}/settings?error=quota_exceeded`);
      }
      return NextResponse.redirect(`${baseUrl}/settings?error=strava_auth_failed`);
    }

    if (!code) {
      logger.error('No authorization code received from Strava');
      return NextResponse.redirect(`${baseUrl}/settings?error=no_code`);
    }

    const clientId = process.env.STRAVA_CLIENT_ID;
    const clientSecret = process.env.STRAVA_CLIENT_SECRET;
    
    // Determine redirect URI based on environment
    const redirectUri = process.env.STRAVA_REDIRECT_URI || 
      `${baseUrl}/api/strava/callback`;

    if (!clientId || !clientSecret) {
      logger.error('Missing Strava credentials:', {
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
        redirect_uri: redirectUri, // Include redirect_uri in token exchange
      }),
    });

    if (!tokenResponse.ok) {
      const errorText = await tokenResponse.text();
      logger.error('Strava token exchange failed:', {
        status: tokenResponse.status,
        statusText: tokenResponse.statusText,
        error: errorText,
      });
      
      // Check for 403 quota limit error
      if (tokenResponse.status === 403 || errorText.includes('quota') || errorText.includes('limit') || errorText.includes('exceeded')) {
        return NextResponse.redirect(`${baseUrl}/settings?error=quota_exceeded`);
      }
      
      return NextResponse.redirect(`${baseUrl}/settings?error=token_exchange_failed`);
    }

    const tokenData = await tokenResponse.json();
    const { access_token, refresh_token, athlete, expires_at } = tokenData;

    if (!access_token || !athlete) {
      logger.error('Invalid token response from Strava:', tokenData);
      return NextResponse.redirect(`${baseUrl}/settings?error=invalid_token_response`);
    }

    // Calculate token expiration (use expires_at from Strava if available)
    const tokenExpiresAt = expires_at 
      ? new Date(expires_at * 1000)
      : (() => {
          const date = new Date();
          date.setHours(date.getHours() + 6); // Default 6 hours
          return date;
        })();

    // Get user ID from session
    const userId = await getUserId();
    
    if (!userId) {
      // User not logged in - store tokens temporarily and redirect to sign in
      // After login, we can complete the connection
      if (state) {
        try {
          await storeOAuthState(state, code, {
            accessToken: access_token,
            refreshToken: refresh_token || '',
            athleteId: athlete.id,
            expiresAt: tokenExpiresAt,
          });
          
          // Store state in cookie for retrieval after login
          const signInUrl = new URL('/auth/signin', baseUrl);
          signInUrl.searchParams.set('strava_oauth', 'pending');
          signInUrl.searchParams.set('state', state);
          signInUrl.searchParams.set('callbackUrl', `${baseUrl}/settings`);
          
          return NextResponse.redirect(signInUrl.toString());
        } catch (error) {
          logger.error('Failed to store OAuth state:', error);
        }
      }
      
      // Fallback: redirect to sign in with message
      return NextResponse.redirect(`${baseUrl}/auth/signin?error=login_required&message=Please sign in to complete Strava connection`);
    }
    
    // Try to save to database
    try {
      await saveStravaConnection({
        athleteId: athlete.id,
        accessToken: access_token,
        refreshToken: refresh_token,
        tokenExpiresAt,
      }, userId);
      
      // Clean up OAuth state if it exists
      if (state) {
        await deleteOAuthState(state).catch(() => {}); // Ignore errors
      }
      
      logger.info('Strava connection saved to database for user:', userId);
    } catch (dbError) {
      logger.error('Database save failed, falling back to cookies:', dbError);
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
    logger.info('Strava connected successfully:', {
      athleteId: athlete.id,
      athleteName: `${athlete.firstname} ${athlete.lastname}`,
      hasAccessToken: !!access_token,
      hasRefreshToken: !!refresh_token,
    });

    return redirectResponse;
  } catch (error) {
    logger.error('Unexpected error in Strava callback:', error);
    // Get base URL for error redirect
    const host = request.headers.get('host') || '';
    const protocol = host.includes('localhost') ? 'http' : 'https';
    const baseUrl = `${protocol}://${host}`;
    return NextResponse.redirect(`${baseUrl}/settings?error=unexpected_error`);
  }
}
