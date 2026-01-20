import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/goal - Get the current goal
 * POST /api/goal - Save/update the goal
 */
export async function GET(request: NextRequest) {
  try {
    // TODO: Load from database
    // For now, try to load from cookies or return default
    const cookieHeader = request.headers.get('cookie') || '';
    
    console.log('Loading goal, cookies:', cookieHeader.substring(0, 200));
    
    // Check if goal is stored in cookie (temporary solution)
    const goalCookieMatch = cookieHeader.match(/user_goal=([^;]+)/);
    
    if (goalCookieMatch && goalCookieMatch[1]) {
      try {
        // Decode the cookie value (it's URL encoded when set)
        let cookieValue = goalCookieMatch[1];
        // Replace + with space (URL encoding) and decode
        cookieValue = cookieValue.replace(/\+/g, ' ');
        cookieValue = decodeURIComponent(cookieValue);
        
        const goal = JSON.parse(cookieValue);
        console.log('Loaded goal from cookie:', goal);
        return NextResponse.json(goal);
      } catch (e) {
        console.error('Error parsing goal cookie:', e, 'Cookie value:', goalCookieMatch[1]);
        // Invalid cookie, fall through to default
      }
    }
    
    console.log('No valid goal cookie found, returning default');
    
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
