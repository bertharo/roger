# Database Setup Guide

This app uses Neon (serverless Postgres) for data persistence.

## Setup Steps

1. **Create a Neon database** at https://neon.tech
2. **Get your connection string** from the Neon dashboard
   - It should look like: `postgresql://user:password@host/database?sslmode=require`
3. **Add to your `.env` file**:
   ```
   DATABASE_URL=postgresql://user:password@host/database?sslmode=require
   ```
4. **Run the schema** to create tables:
   ```bash
   # Option 1: Using Neon's SQL Editor
   # Copy the contents of lib/db/schema.sql and run it in the Neon SQL Editor
   
   # Option 2: Using psql (if you have it installed)
   psql $DATABASE_URL -f lib/db/schema.sql
   ```

## Schema

The database includes:
- **users**: User accounts (for future multi-user support)
- **goals**: Race goals (distance, date, target time)
- **strava_connections**: Strava OAuth tokens and athlete info

## Migration from Cookies/LocalStorage

The app automatically falls back to cookies/localStorage if the database is not available. Once you set up the database:

1. Goals will be saved to the database instead of localStorage
2. Strava tokens will be saved to the database instead of cookies
3. Existing data in cookies/localStorage will still work as a fallback

## Environment Variables

Add these to your Vercel project settings (or `.env.local` for local development):

- `DATABASE_URL`: Your Neon connection string
- `OPENAI_API_KEY`: Your OpenAI API key
- `STRAVA_CLIENT_ID`: Your Strava app client ID
- `STRAVA_CLIENT_SECRET`: Your Strava app client secret

## Testing

After setting up the database, test by:
1. Saving a goal in Settings → Edit Goal
2. Checking the `goals` table in Neon dashboard
3. Connecting Strava and checking the `strava_connections` table
