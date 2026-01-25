import { NextRequest, NextResponse } from 'next/server';
import { query, queryOne } from '@/lib/db/client';
import { getUserId } from '@/lib/auth/getSession';
import { logger } from '@/lib/utils/logger';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

// Simple admin check - in production, add proper admin role
const ADMIN_USER_IDS = process.env.ADMIN_USER_IDS?.split(',').filter(Boolean) || [];

export async function GET(request: NextRequest) {
  try {
    const userId = await getUserId();
    
    if (!userId || !ADMIN_USER_IDS.includes(userId)) {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 403 }
      );
    }
    
    // Get today's stats
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = today.toISOString().split('T')[0];
    
    // Global daily cost
    const dailyCost = await queryOne<{
      total_cost_usd: number;
      total_requests: number;
    }>`
      SELECT total_cost_usd, total_requests
      FROM daily_costs
      WHERE date = ${dateStr}
    `;
    
    // Total users
    const totalUsers = await queryOne<{ count: string }>`
      SELECT COUNT(*)::text as count FROM users
    `;
    
    // Active users (last 7 days)
    const activeUsers = await queryOne<{ count: string }>`
      SELECT COUNT(DISTINCT user_id)::text as count
      FROM api_usage
      WHERE created_at >= NOW() - INTERVAL '7 days'
    `;
    
    // Top users by usage today
    const topUsers = await query<{
      email: string;
      name: string | null;
      chat_messages: number;
      plan_generations: number;
      total_cost_usd: number;
    }>`
      SELECT 
        u.email,
        u.name,
        du.chat_messages,
        du.plan_generations,
        du.total_cost_usd
      FROM daily_usage du
      JOIN users u ON u.id = du.user_id
      WHERE du.date = ${dateStr}
      ORDER BY du.total_cost_usd DESC
      LIMIT 10
    `;
    
    return NextResponse.json({
      today: {
        cost: dailyCost?.total_cost_usd || 0,
        requests: dailyCost?.total_requests || 0,
      },
      users: {
        total: parseInt(totalUsers?.count || '0', 10),
        activeLast7Days: parseInt(activeUsers?.count || '0', 10),
      },
      topUsers: topUsers || [],
    });
      } catch (error) {
        logger.error('Admin stats error:', error);
    return NextResponse.json(
      { error: 'Failed to fetch stats' },
      { status: 500 }
    );
  }
}
