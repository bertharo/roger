/**
 * Strava API Client
 * 
 * Use this to fetch activities from Strava API.
 * 
 * Example usage:
 * ```typescript
 * const client = new StravaClient(accessToken);
 * const activities = await client.getRecentActivities(5);
 * ```
 */

export interface StravaActivity {
  id: number;
  name: string;
  distance: number; // meters
  moving_time: number; // seconds
  elapsed_time: number; // seconds
  total_elevation_gain: number; // meters
  type: string;
  start_date: string; // ISO 8601
  average_speed: number; // meters per second
  average_heartrate?: number;
  max_heartrate?: number;
  description?: string;
}

export class StravaClient {
  private accessToken: string;

  constructor(accessToken: string) {
    this.accessToken = accessToken;
  }

  /**
   * Get recent activities from Strava
   */
  async getRecentActivities(perPage: number = 10): Promise<StravaActivity[]> {
    const response = await fetch(
      `https://www.strava.com/api/v3/athlete/activities?per_page=${perPage}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Strava API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Get a specific activity by ID
   */
  async getActivity(activityId: number): Promise<StravaActivity> {
    const response = await fetch(
      `https://www.strava.com/api/v3/activities/${activityId}`,
      {
        headers: {
          Authorization: `Bearer ${this.accessToken}`,
        },
      }
    );

    if (!response.ok) {
      throw new Error(`Strava API error: ${response.statusText}`);
    }

    return response.json();
  }

  /**
   * Convert Strava activity to our Run format
   */
  static convertActivityToRun(activity: StravaActivity): {
    id: string;
    date: string;
    distanceMiles: number;
    durationSeconds: number;
    averagePaceMinPerMile: number;
    type?: 'easy' | 'tempo' | 'interval' | 'long' | 'race' | 'recovery';
    elevationFeet?: number;
    notes?: string;
  } {
    const distanceMiles = activity.distance / 1609.34; // meters to miles
    const durationSeconds = activity.moving_time;
    const averagePaceMinPerMile = durationSeconds / 60 / distanceMiles;
    const elevationFeet = activity.total_elevation_gain * 3.28084; // meters to feet

    // Infer run type from activity name or type
    let runType: 'easy' | 'tempo' | 'interval' | 'long' | 'race' | 'recovery' | undefined;
    const nameLower = activity.name.toLowerCase();
    if (nameLower.includes('easy') || nameLower.includes('recovery')) {
      runType = 'easy';
    } else if (nameLower.includes('tempo')) {
      runType = 'tempo';
    } else if (nameLower.includes('interval') || nameLower.includes('track')) {
      runType = 'interval';
    } else if (nameLower.includes('long')) {
      runType = 'long';
    } else if (nameLower.includes('race')) {
      runType = 'race';
    }

    return {
      id: activity.id.toString(),
      date: activity.start_date,
      distanceMiles: Math.round(distanceMiles * 10) / 10,
      durationSeconds,
      averagePaceMinPerMile: Math.round(averagePaceMinPerMile * 10) / 10,
      type: runType,
      elevationFeet: Math.round(elevationFeet),
      notes: activity.description || undefined,
    };
  }
}
