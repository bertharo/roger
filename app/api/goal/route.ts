import { NextRequest, NextResponse } from 'next/server';
import { getGoal, saveGoal } from '@/lib/db/goals';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/goal - Get the current goal
 * POST /api/goal - Save/update the goal
 */
export async function GET(request: NextRequest) {
  try {
    // Try to load from database first
    try {
      const goalRow = await getGoal();
      if (goalRow) {
        return NextResponse.json({
          raceDate: goalRow.race_date_iso,
          distance: Number(goalRow.distance_mi),
          targetTimeMinutes: goalRow.target_time_minutes,
        });
      }
    } catch (dbError) {
      console.error('Database error, falling back to localStorage/cookies:', dbError);
    }
    
    // Fallback to localStorage/cookies if database fails
    const cookieHeader = request.headers.get('cookie') || '';
    const goalCookieMatch = cookieHeader.match(/user_goal=([^;]+)/);
    
    if (goalCookieMatch && goalCookieMatch[1]) {
      try {
        let cookieValue = goalCookieMatch[1];
        cookieValue = cookieValue.replace(/\+/g, ' ');
        cookieValue = decodeURIComponent(cookieValue);
        const goal = JSON.parse(cookieValue);
        return NextResponse.json({
          raceDate: goal.raceDateISO,
          distance: goal.distanceMi,
          targetTimeMinutes: goal.targetTimeMinutes,
        });
      } catch (e) {
        // Invalid cookie
      }
    }
    
    // Return default/mock goal
    return NextResponse.json({
      raceDate: '2024-03-15T08:00:00Z',
      distance: 13.1,
      targetTimeMinutes: 95,
    });
  } catch (error) {
    console.error('Error loading goal:', error);
    return NextResponse.json(
      { error: 'Failed to load goal' },
      { status: 500 }
    );
  }
}

export async function POST(request: NextRequest) {
  try {
    const body = await request.json();
    const { raceName, raceDateISO, distanceMi, targetTimeMinutes } = body;
    
    if (!raceDateISO || !distanceMi || !targetTimeMinutes) {
      return NextResponse.json(
        { error: 'Missing required fields' },
        { status: 400 }
      );
    }
    
    // Try to save to database first
    try {
      const goalRow = await saveGoal({
        raceName,
        raceDateISO,
        distanceMi,
        targetTimeMinutes,
      });
      
      return NextResponse.json({
        success: true,
        goal: {
          raceDate: goalRow.race_date_iso,
          distance: Number(goalRow.distance_mi),
          targetTimeMinutes: goalRow.target_time_minutes,
        },
      });
    } catch (dbError) {
      console.error('Database save failed, falling back to localStorage:', dbError);
      // Fallback: return success but don't save to DB
      // Frontend will handle localStorage
      return NextResponse.json({
        success: true,
        goal: {
          raceDate: raceDateISO,
          distance: distanceMi,
          targetTimeMinutes,
        },
        warning: 'Database not available, using localStorage',
      });
    }
  } catch (error) {
    console.error('Error saving goal:', error);
    return NextResponse.json(
      { error: 'Failed to save goal' },
      { status: 500 }
    );
  }
}
