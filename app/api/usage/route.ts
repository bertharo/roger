import { NextRequest, NextResponse } from 'next/server';
import { getUserId } from '@/lib/auth/getSession';
import { getUserDailyUsage, RATE_LIMITS } from '@/lib/rateLimit';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    
    if (!userId) {
      return NextResponse.json(
        { error: 'Authentication required' },
        { status: 401 }
      );
    }
    
    const usage = await getUserDailyUsage(userId);
    
    return NextResponse.json({
      chat_messages: usage.chat_messages,
      plan_generations: usage.plan_generations,
      chat_limit: RATE_LIMITS.CHAT_MESSAGES_PER_DAY,
      plan_limit: RATE_LIMITS.PLAN_GENERATIONS_PER_DAY,
    });
  } catch (error) {
    console.error('Usage API error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch usage' },
      { status: 500 }
    );
  }
}
