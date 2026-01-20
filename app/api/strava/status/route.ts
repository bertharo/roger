import { NextRequest } from 'next/server';
import { getStravaConnection } from '@/lib/db/strava';

/**
 * Check Strava Connection Status
 * 
 * Returns whether the user has Strava connected.
 * Checks database first, falls back to cookies.
 */
export async function GET(request: NextRequest) {
  try {
    // Try database first
    try {
      const connection = await getStravaConnection();
      if (connection && connection.access_token) {
        // Check if token is expired
        const isExpired = connection.token_expires_at 
          ? new Date(connection.token_expires_at) < new Date()
          : false;
        
        if (!isExpired) {
          return Response.json({
            connected: true,
            message: 'Strava connected successfully.',
          });
        }
      }
    } catch (dbError) {
      console.error('Database check failed, falling back to cookies:', dbError);
    }
    
    // Fallback to cookies
    const cookieHeader = request.headers.get('cookie') || '';
    const stravaToken = cookieHeader.includes('strava_access_token=');
    
    return Response.json({
      connected: stravaToken,
      message: stravaToken 
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
