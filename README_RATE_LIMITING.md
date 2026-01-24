# Rate Limiting & Usage Tracking

This document describes the rate limiting and cost monitoring system implemented in Phase 1.

## Overview

The app now includes:
- **Per-user rate limiting**: Limits chat messages and plan generations per day
- **Cost tracking**: Tracks OpenAI API usage and costs per user and globally
- **Usage display**: Shows users their daily usage in the dashboard
- **Admin dashboard**: API endpoint for viewing system-wide stats

## Rate Limits (Default)

- **Chat messages**: 30 per user per day
- **Plan generations**: 5 per user per day
- **Global daily cost limit**: $10.00 (stops all API calls if exceeded)

These can be overridden via environment variables:
```bash
CHAT_MESSAGES_PER_DAY=30
PLAN_GENERATIONS_PER_DAY=5
GLOBAL_DAILY_COST_LIMIT_USD=10.00
```

## Database Schema

Three new tables were added:

1. **`api_usage`**: Tracks every API call with tokens used and cost
2. **`daily_usage`**: Tracks daily totals per user (chat messages, plan generations, cost)
3. **`daily_costs`**: Tracks global daily costs and request counts

## Setup

1. **Run the migration**:
   ```bash
   # Copy scripts/migrate-usage-tracking.sql and run in Neon SQL Editor
   # Or via psql:
   psql $DATABASE_URL -f scripts/migrate-usage-tracking.sql
   ```

2. **Set admin user IDs** (optional):
   ```bash
   ADMIN_USER_IDS=your-user-id-here,another-admin-id
   ```

3. **Deploy**: The system will automatically start tracking usage

## API Endpoints

### `/api/usage` (GET)
Returns current user's daily usage:
```json
{
  "chat_messages": 15,
  "plan_generations": 2,
  "chat_limit": 30,
  "plan_limit": 5
}
```

### `/api/admin/stats` (GET)
Admin-only endpoint for system stats:
```json
{
  "today": {
    "cost": 2.45,
    "requests": 150
  },
  "users": {
    "total": 25,
    "activeLast7Days": 18
  },
  "topUsers": [...]
}
```

## User Experience

- **Usage Indicator**: Shows in dashboard with progress bars
- **Rate limit errors**: Friendly messages when limits are reached
- **Usage info in responses**: Chat and plan APIs return remaining usage

## Cost Estimates

- Average chat message: ~$0.0003 (500 input + 200 output tokens)
- Average plan generation: ~$0.001 (2000 tokens)
- 30 active users: ~$12-15/month estimated

## Monitoring

Check costs daily via:
1. Admin stats API: `/api/admin/stats`
2. Database: Query `daily_costs` table
3. OpenAI dashboard: Monitor actual costs

## Next Steps

- Add email alerts when daily costs exceed threshold
- Create admin UI page for viewing stats
- Add weekly/monthly usage reports
- Consider caching to reduce API calls
