-- Migration: Add fitness_assessments table
-- This table stores user fitness assessments for plan generation when Strava is not connected

CREATE TABLE IF NOT EXISTS fitness_assessments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  fitness_level VARCHAR(20) NOT NULL CHECK (fitness_level IN ('beginner', 'intermediate', 'advanced')),
  weekly_mileage DECIMAL(5, 2) NOT NULL CHECK (weekly_mileage > 0),
  days_per_week INTEGER NOT NULL CHECK (days_per_week >= 3 AND days_per_week <= 7),
  easy_pace_min_per_mile DECIMAL(4, 2) CHECK (easy_pace_min_per_mile >= 5.0 AND easy_pace_min_per_mile <= 15.0),
  recent_running_experience VARCHAR(20) NOT NULL CHECK (recent_running_experience IN ('none', 'some', 'regular')),
  longest_run_miles DECIMAL(5, 2) CHECK (longest_run_miles > 0),
  completed_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(user_id) -- One assessment per user (most recent)
);

-- Create index for faster lookups
CREATE INDEX IF NOT EXISTS idx_fitness_assessments_user_id ON fitness_assessments(user_id);
CREATE INDEX IF NOT EXISTS idx_fitness_assessments_completed_at ON fitness_assessments(completed_at DESC);

-- Add comment
COMMENT ON TABLE fitness_assessments IS 'Stores user fitness assessments for generating personalized training plans when Strava data is not available';
