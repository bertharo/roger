import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth/getSession';
import { getValidAccessToken, refreshStravaToken } from '@/lib/strava/refresh';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * POST /api/strava/refresh - Manually refresh Strava token and fetch new activities
 */
export async function POST(request: NextRequest) {
  try {
    const userId = await getUserId();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    // Force refresh the token
    const refreshed = await refreshStravaToken(userId);
    
    if (!refreshed) {
      return NextResponse.json(
        { error: 'Failed to refresh token. Please reconnect Strava in settings.' },
        { status: 401 }
      );
    }
    
    // Fetch new activities with refreshed token
    const response = await fetch('https://www.strava.com/api/v3/athlete/activities?per_page=30', {
      headers: {
        'Authorization': `Bearer ${refreshed.accessToken}`,
      },
    });
    
    if (!response.ok) {
      return NextResponse.json(
        { error: 'Failed to fetch activities from Strava' },
        { status: response.status }
      );
    }
    
    const activities = await response.json();
    
    // Transform Strava activities to our Run format
    const runs = activities
      .filter((activity: any) => activity.type === 'Run')
      .map((activity: any) => ({
        id: String(activity.id),
        date: activity.start_date,
        distanceMiles: activity.distance / 1609.34,
        durationSeconds: activity.moving_time || activity.elapsed_time,
        averagePaceMinPerMile: (activity.moving_time || activity.elapsed_time) / 60 / (activity.distance / 1609.34),
        type: inferRunType(activity),
        elevationFeet: activity.total_elevation_gain ? activity.total_elevation_gain * 3.28084 : undefined,
        notes: activity.name,
        effort: activity.perceived_exertion || undefined,
      }))
      .slice(0, 30);
    
    return NextResponse.json({
      success: true,
      runs,
      refreshed: true,
      message: 'Strava data refreshed successfully',
    });
  } catch (error) {
    console.error('Error refreshing Strava data:', error);
    return NextResponse.json(
      { error: 'Failed to refresh Strava data' },
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
  
  return 'easy';
}
