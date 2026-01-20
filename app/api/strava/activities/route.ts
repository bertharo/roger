import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/strava/activities - Fetch recent activities from Strava
 */
export async function GET(request: NextRequest) {
  try {
    // Get access token from cookies
    const cookieHeader = request.headers.get('cookie') || '';
    const tokenCookie = cookieHeader
      .split(';')
      .find(c => c.trim().startsWith('strava_access_token='));
    
    if (!tokenCookie) {
      return NextResponse.json(
        { error: 'Not connected to Strava' },
        { status: 401 }
      );
    }
    
    const accessToken = tokenCookie.split('=')[1].trim();
    
    // Fetch recent activities from Strava
    const response = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', {
      headers: {
        'Authorization': `Bearer ${accessToken}`,
      },
    });
    
    if (!response.ok) {
      if (response.status === 401) {
        // Token expired, need to refresh
        return NextResponse.json(
          { error: 'Strava token expired. Please reconnect.' },
          { status: 401 }
        );
      }
      throw new Error(`Strava API error: ${response.status}`);
    }
    
    const activities = await response.json();
    
    // Transform Strava activities to our Run format
    const runs = activities
      .filter((activity: any) => activity.type === 'Run')
      .map((activity: any) => ({
        id: String(activity.id),
        date: activity.start_date,
        distanceMiles: activity.distance / 1609.34, // Convert meters to miles
        durationSeconds: activity.moving_time || activity.elapsed_time,
        averagePaceMinPerMile: (activity.moving_time || activity.elapsed_time) / 60 / (activity.distance / 1609.34),
        type: inferRunType(activity),
        elevationFeet: activity.total_elevation_gain ? activity.total_elevation_gain * 3.28084 : undefined, // Convert meters to feet
        notes: activity.name,
        effort: activity.perceived_exertion || undefined,
      }))
      .slice(0, 30); // Get most recent 30 runs
    
    return NextResponse.json({ runs });
  } catch (error) {
    console.error('Error fetching Strava activities:', error);
    return NextResponse.json(
      { error: 'Failed to fetch Strava activities' },
      { status: 500 }
    );
  }
}

function inferRunType(activity: any): 'easy' | 'tempo' | 'interval' | 'long' | 'race' | 'recovery' {
  const name = (activity.name || '').toLowerCase();
  const distance = activity.distance / 1609.34; // miles
  
  if (name.includes('race') || name.includes('5k') || name.includes('10k') || name.includes('half') || name.includes('marathon')) {
    return 'race';
  }
  if (name.includes('tempo') || name.includes('threshold')) {
    return 'tempo';
  }
  if (name.includes('interval') || name.includes('track') || name.includes('speed')) {
    return 'interval';
  }
  if (distance >= 10) {
    return 'long';
  }
  if (name.includes('recovery') || name.includes('easy')) {
    return 'recovery';
  }
  
  // Default to easy
  return 'easy';
}
