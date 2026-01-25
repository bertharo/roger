import { query, queryOne } from '@/lib/db/client';
import { logger } from '@/lib/utils/logger';

// OpenAI pricing (GPT-4o-mini as of 2024)
const PRICING = {
  INPUT_COST_PER_1M_TOKENS: 0.15, // $0.15 per 1M input tokens
  OUTPUT_COST_PER_1M_TOKENS: 0.60, // $0.60 per 1M output tokens
};

/**
 * Calculate cost from token usage
 */
export function calculateCost(
  inputTokens: number,
  outputTokens: number
): number {
  const inputCost = (inputTokens / 1_000_000) * PRICING.INPUT_COST_PER_1M_TOKENS;
  const outputCost = (outputTokens / 1_000_000) * PRICING.OUTPUT_COST_PER_1M_TOKENS;
  return inputCost + outputCost;
}

/**
 * Track API usage and cost
 */
export async function trackUsage(
  userId: string,
  endpoint: string,
  inputTokens: number,
  outputTokens: number
): Promise<void> {
  try {
    const cost = calculateCost(inputTokens, outputTokens);
    const totalTokens = inputTokens + outputTokens;
    
    // Record usage
    await query`
      INSERT INTO api_usage (user_id, endpoint, tokens_used, estimated_cost_usd)
      VALUES (${userId}, ${endpoint}, ${totalTokens}, ${cost})
    `;
    
    // Update daily usage cost
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = today.toISOString().split('T')[0];
    
    await query`
      INSERT INTO daily_usage (user_id, date, total_cost_usd)
      VALUES (${userId}, ${dateStr}, ${cost})
      ON CONFLICT (user_id, date)
      DO UPDATE SET
        total_cost_usd = daily_usage.total_cost_usd + ${cost},
        updated_at = NOW()
    `;
    
    // Update global daily cost
    await query`
      INSERT INTO daily_costs (date, total_cost_usd, total_requests)
      VALUES (${dateStr}, ${cost}, 1)
      ON CONFLICT (date)
      DO UPDATE SET
        total_cost_usd = daily_costs.total_cost_usd + ${cost},
        total_requests = daily_costs.total_requests + 1,
        updated_at = NOW()
    `;
  } catch (error) {
    // If database query fails, log but don't throw (non-critical for functionality)
    logger.error('Error tracking usage (non-critical):', error);
  }
}

/**
 * Get today's global cost
 */
export async function getTodayGlobalCost(): Promise<number> {
  try {
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const dateStr = today.toISOString().split('T')[0];
    
    const result = await queryOne<{ total_cost_usd: number }>`
      SELECT total_cost_usd
      FROM daily_costs
      WHERE date = ${dateStr}
    `;
    
    return result?.total_cost_usd || 0;
  } catch (error) {
    // If database query fails, return 0 (allow requests)
    logger.error('Error getting today global cost, returning 0:', error);
    return 0;
  }
}
