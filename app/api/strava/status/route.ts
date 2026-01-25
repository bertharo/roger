import { NextRequest } from 'next/server';
import { getStravaConnection } from '@/lib/db/strava';
import { getUserId } from '@/lib/auth/getSession';
import { logger } from '@/lib/utils/logger';

/**
 * Check Strava Connection Status
 * 
 * Returns whether the user has Strava connected.
 * Checks database first, falls back to cookies.
 */
export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    
    // Try database first (if user is logged in)
    if (userId) {
      try {
        const connection = await getStravaConnection(userId);
        if (connection && connection.access_token) {
          // Check if token is expired
          const isExpired = connection.token_expires_at 
            ? new Date(connection.token_expires_at) < new Date()
            : false;
          
          if (!isExpired) {
            return Response.json({
              connected: true,
              message: 'Strava connected successfully.',
              lastSync: connection.updated_at,
            });
          }
        }
      } catch (dbError) {
        logger.error('Database check failed, falling back to cookies:', dbError);
      }
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
    logger.error('Error checking Strava status:', error);
    return Response.json({
      connected: false,
      message: 'Error checking connection status.',
    });
  }
}
