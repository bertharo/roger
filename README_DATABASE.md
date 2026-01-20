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
- **users**: User accounts with email/password authentication
- **accounts**: OAuth provider accounts (for future OAuth support)
- **sessions**: User session tokens
- **verification_tokens**: Email verification tokens
- **goals**: Race goals (distance, date, target time) - user-specific
- **strava_connections**: Strava OAuth tokens and athlete info - user-specific

## Migration from Cookies/LocalStorage

After setting up authentication:

1. Users must sign up/sign in to use the app
2. Goals are saved to the database and are user-specific
3. Strava connections are saved to the database and are user-specific
4. Each user has their own isolated data

## Running the Migration

If you already have the database set up, run the migration script to add authentication tables:

```bash
# Option 1: Using Neon's SQL Editor
# Copy the contents of scripts/migrate-auth.sql and run it in the Neon SQL Editor

# Option 2: Using psql
psql $DATABASE_URL -f scripts/migrate-auth.sql
```

## Environment Variables

Add these to your Vercel project settings (or `.env.local` for local development):

- `DATABASE_URL`: Your Neon connection string
- `NEXTAUTH_SECRET`: A random secret for NextAuth.js (generate with `openssl rand -base64 32`)
- `NEXTAUTH_URL`: Your app URL (e.g., `http://localhost:3000` for local, `https://yourdomain.com` for production)
- `OPENAI_API_KEY`: Your OpenAI API key
- `STRAVA_CLIENT_ID`: Your Strava app client ID
- `STRAVA_CLIENT_SECRET`: Your Strava app client secret

## Testing

After setting up the database, test by:
1. Saving a goal in Settings → Edit Goal
2. Checking the `goals` table in Neon dashboard
3. Connecting Strava and checking the `strava_connections` table
