import { NextRequest, NextResponse } from 'next/server';
import { getDbClient } from '@/lib/db/client';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * GET /api/goal/test - Test database connection
 */
export async function GET(request: NextRequest) {
  try {
    const hasDatabaseUrl = !!process.env.DATABASE_URL;
    
    if (!hasDatabaseUrl) {
      return NextResponse.json({
        connected: false,
        error: 'DATABASE_URL not set',
        message: 'Please add DATABASE_URL to your Vercel environment variables',
      });
    }
    
    // Test database connection
    const client = getDbClient();
    const result = await client`
      SELECT COUNT(*) as count FROM goals
    `;
    
    return NextResponse.json({
      connected: true,
      hasDatabaseUrl: true,
      goalCount: result[0]?.count || 0,
      message: 'Database connection successful',
    });
  } catch (error: any) {
    return NextResponse.json({
      connected: false,
      hasDatabaseUrl: !!process.env.DATABASE_URL,
      error: error.message,
      stack: process.env.NODE_ENV === 'development' ? error.stack : undefined,
    }, { status: 500 });
  }
}
