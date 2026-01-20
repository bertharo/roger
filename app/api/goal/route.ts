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
    
    // Convert dashboard format to core format
    const goal = {
      raceDate: raceDateISO,
      distance: distanceMi,
      targetTimeMinutes,
    };
    
    // TODO: Save to database
    // For now, store in cookie (temporary solution)
    const response = NextResponse.json({ success: true, goal });
    
    // Store goal in cookie (temporary until database is set up)
    const goalCookie = JSON.stringify({
      raceName,
      raceDateISO,
      distanceMi,
      targetTimeMinutes,
    });
    
    // Encode the cookie value to handle special characters
    const encodedCookie = encodeURIComponent(goalCookie);
    response.cookies.set('user_goal', encodedCookie, {
      httpOnly: false, // Allow client-side access for now
      secure: process.env.NODE_ENV === 'production',
      sameSite: 'lax',
      maxAge: 60 * 60 * 24 * 365, // 1 year
      path: '/',
    });
    
    console.log('Goal cookie set:', { original: goalCookie, encoded: encodedCookie });
    
    return response;
  } catch (error) {
    console.error('Error saving goal:', error);
    return NextResponse.json(
      { error: 'Failed to save goal' },
      { status: 500 }
    );
  }
}
