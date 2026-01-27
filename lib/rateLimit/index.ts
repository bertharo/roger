import { query, queryOne } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger';

export interface RateLimitResult {
  allowed: boolean;
  remaining: number;
  resetAt: Date;
  limit: number;
}

export interface DailyUsage {
  chat_messages: number;
  plan_generations: number;
  total_cost_usd: number;
}

// Rate limits configuration
export const RATE_LIMITS = {
  CHAT_MESSAGES_PER_DAY: parseInt(process.env.CHAT_MESSAGES_PER_DAY || '30', 10),
  PLAN_GENERATIONS_PER_DAY: parseInt(process.env.PLAN_GENERATIONS_PER_DAY || '5', 10),
  DAILY_COST_LIMIT_USD: parseFloat(process.env.DAILY_COST_LIMIT_USD || '0.50'),
  GLOBAL_DAILY_COST_LIMIT_USD: parseFloat(process.env.GLOBAL_DAILY_COST_LIMIT_USD || '10.00'),
} as const;

/**
 * Check if user can make a chat request
 */
export async function checkChatRateLimit(
  userId: string
): Promise<RateLimitResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const usage = await getOrCreateDailyUsage(userId, today);
  const remaining = RATE_LIMITS.CHAT_MESSAGES_PER_DAY - usage.chat_messages;
  const resetAt = new Date(today);
  resetAt.setDate(resetAt.getDate() + 1);
  
  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
    resetAt,
    limit: RATE_LIMITS.CHAT_MESSAGES_PER_DAY,
  };
}

/**
 * Check if user can generate a plan
 */
export async function checkPlanRateLimit(
  userId: string
): Promise<RateLimitResult> {
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  
  const usage = await getOrCreateDailyUsage(userId, today);
  const remaining = RATE_LIMITS.PLAN_GENERATIONS_PER_DAY - usage.plan_generations;
  const resetAt = new Date(today);
  resetAt.setDate(resetAt.getDate() + 1);
  
  return {
    allowed: remaining > 0,
    remaining: Math.max(0, remaining),
    resetAt,
    limit: RATE_LIMITS.PLAN_GENERATIONS_PER_DAY,
  };
}

/**
 * Check global daily cost limit
 */
export async function checkGlobalCostLimit(): Promise<{
  allowed: boolean;
  currentCost: number;
  limit: number;
}> {
  try {
    // Check if DATABASE_URL is configured before attempting query
    if (!process.env.DATABASE_URL) {
      return {
        allowed: true,
        currentCost: 0,
        limit: RATE_LIMITS.GLOBAL_DAILY_COST_LIMIT_USD,
      };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = today.toISOString().split('T')[0];
    
    const dailyCost = await queryOne<{ total_cost_usd: number }>`
      SELECT total_cost_usd
      FROM daily_costs
      WHERE date = ${dateStr}
    `;
    
    const currentCost = dailyCost?.total_cost_usd || 0;
    
    return {
      allowed: currentCost < RATE_LIMITS.GLOBAL_DAILY_COST_LIMIT_USD,
      currentCost,
      limit: RATE_LIMITS.GLOBAL_DAILY_COST_LIMIT_USD,
    };
  } catch (error: any) {
    // If database query fails (e.g., table doesn't exist), allow the request
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      logger.debug('Daily costs table does not exist, allowing request');
    } else {
      logger.error('Error checking global cost limit, allowing request:', error);
    }
    return {
      allowed: true,
      currentCost: 0,
      limit: RATE_LIMITS.GLOBAL_DAILY_COST_LIMIT_USD,
    };
  }
}

/**
 * Get or create daily usage record
 */
async function getOrCreateDailyUsage(
  userId: string,
  date: Date
): Promise<DailyUsage> {
  try {
    // Check if DATABASE_URL is configured before attempting query
    if (!process.env.DATABASE_URL) {
      return {
        chat_messages: 0,
        plan_generations: 0,
        total_cost_usd: 0,
      };
    }
    
    const dateStr = date.toISOString().split('T')[0];
    
    let usage = await queryOne<DailyUsage>`
      SELECT chat_messages, plan_generations, total_cost_usd
      FROM daily_usage
      WHERE user_id = ${userId} AND date = ${dateStr}
    `;
    
    if (!usage) {
      await query`
        INSERT INTO daily_usage (user_id, date)
        VALUES (${userId}, ${dateStr})
        ON CONFLICT (user_id, date) DO NOTHING
      `;
      usage = {
        chat_messages: 0,
        plan_generations: 0,
        total_cost_usd: 0,
      };
    }
    
    return usage;
  } catch (error: any) {
    // If database query fails (e.g., table doesn't exist), return default usage
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      logger.debug('Daily usage table does not exist, returning default');
    } else {
      logger.error('Error getting daily usage, returning default:', error);
    }
    return {
      chat_messages: 0,
      plan_generations: 0,
      total_cost_usd: 0,
    };
  }
}

/**
 * Increment chat message count
 */
export async function incrementChatUsage(userId: string): Promise<void> {
  try {
    // Check if DATABASE_URL is configured before attempting query
    if (!process.env.DATABASE_URL) {
      return; // Silently skip if database not configured
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = today.toISOString().split('T')[0];
    
    await query`
      INSERT INTO daily_usage (user_id, date, chat_messages)
      VALUES (${userId}, ${dateStr}, 1)
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        chat_messages = daily_usage.chat_messages + 1,
        updated_at = NOW()
    `;
  } catch (error: any) {
    // If database query fails, log but don't throw (non-critical)
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      logger.debug('Daily usage table does not exist, skipping usage tracking');
    } else {
      logger.error('Error incrementing chat usage:', error);
    }
  }
}

/**
 * Increment plan generation count
 */
export async function incrementPlanUsage(userId: string): Promise<void> {
  try {
    // Check if DATABASE_URL is configured before attempting query
    if (!process.env.DATABASE_URL) {
      return; // Silently skip if database not configured
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = today.toISOString().split('T')[0];
    
    await query`
      INSERT INTO daily_usage (user_id, date, plan_generations)
      VALUES (${userId}, ${dateStr}, 1)
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        plan_generations = daily_usage.plan_generations + 1,
        updated_at = NOW()
    `;
  } catch (error: any) {
    // If database query fails (e.g., table doesn't exist), log but don't throw (non-critical)
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      logger.debug('Daily usage table does not exist, skipping usage tracking');
    } else {
      logger.error('Error incrementing plan usage:', error);
    }
  }
}

/**
 * Get user's daily usage
 */
export async function getUserDailyUsage(
  userId: string
): Promise<DailyUsage & { date: string }> {
  try {
    // Check if DATABASE_URL is configured before attempting query
    if (!process.env.DATABASE_URL) {
      const today = new Date();
      today.setHours(0, 0, 0, 0);
      const dateStr = today.toISOString().split('T')[0];
      return {
        chat_messages: 0,
        plan_generations: 0,
        total_cost_usd: 0,
        date: dateStr,
      };
    }
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = today.toISOString().split('T')[0];
    
    const usage = await queryOne<DailyUsage & { date: string }>`
      SELECT chat_messages, plan_generations, total_cost_usd, date
      FROM daily_usage
      WHERE user_id = ${userId} AND date = ${dateStr}
    `;
    
    return usage || {
      chat_messages: 0,
      plan_generations: 0,
      total_cost_usd: 0,
      date: dateStr,
    };
  } catch (error: any) {
    // If database query fails, return default usage
    if (error.message?.includes('does not exist') || error.code === '42P01') {
      logger.debug('Daily usage table does not exist, returning default');
    } else {
      logger.error('Error getting user daily usage, returning default:', error);
    }
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = today.toISOString().split('T')[0];
    return {
      chat_messages: 0,
      plan_generations: 0,
      total_cost_usd: 0,
      date: dateStr,
    };
  }
}
