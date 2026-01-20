-- Fix schema to allow NULL user_id for single-user app
-- Run this in Neon SQL Editor if you already have tables

-- Remove UNIQUE constraint on goals.user_id
ALTER TABLE goals DROP CONSTRAINT IF EXISTS goals_user_id_key;

-- Remove UNIQUE constraint on strava_connections.user_id  
ALTER TABLE strava_connections DROP CONSTRAINT IF EXISTS strava_connections_user_id_key;
