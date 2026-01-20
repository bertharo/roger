import { NextRequest } from 'next/server';

/**
 * Check Strava Connection Status
 * 
 * Returns whether the user has Strava connected.
 * Checks for stored tokens in cookies (temporary solution until database is set up).
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Check database for stored Strava tokens
    // Example:
    // const user = await db.user.findUnique({
    //   where: { id: session.userId },
    //   select: { stravaAccessToken: true },
    // });
    
    // Temporary: Check for token in cookies
    // In production, store tokens securely in database
    const cookieHeader = request.headers.get('cookie') || '';
    const stravaToken = cookieHeader.includes('strava_access_token=');
    
    const connected = stravaToken;
    
    return Response.json({
      connected,
      message: connected 
        ? 'Strava connected successfully.' 
        : 'Using mock data. Connect Strava to sync real runs.',
    });
  } catch (error) {
    console.error('Error checking Strava status:', error);
    return Response.json({
      connected: false,
      message: 'Error checking connection status.',
    });
  }
}
