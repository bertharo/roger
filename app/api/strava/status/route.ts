import { NextRequest } from 'next/server';

/**
 * Check Strava Connection Status
 * 
 * Returns whether the user has Strava connected.
 * In production, check your database for stored tokens.
 */
export async function GET(request: NextRequest) {
  // TODO: Check database for stored Strava tokens
  // Example:
  // const user = await db.user.findUnique({
  //   where: { id: session.userId },
  //   select: { stravaAccessToken: true },
  // });
  
  // For now, return false (using mock data)
  return Response.json({
    connected: false,
    message: 'Using mock data. Connect Strava to sync real runs.',
  });
}
