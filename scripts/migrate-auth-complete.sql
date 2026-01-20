-- Complete migration script to add authentication support
-- Run this in your Neon SQL Editor or via psql

-- Step 1: Add new columns to users table (if they don't exist)
DO $$ 
BEGIN
  -- Add name column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='name') THEN
    ALTER TABLE users ADD COLUMN name VARCHAR(255);
  END IF;
  
  -- Add password_hash column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='password_hash') THEN
    ALTER TABLE users ADD COLUMN password_hash TEXT;
  END IF;
  
  -- Add email_verified column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='email_verified') THEN
    ALTER TABLE users ADD COLUMN email_verified TIMESTAMP WITH TIME ZONE;
  END IF;
  
  -- Add image column
  IF NOT EXISTS (SELECT 1 FROM information_schema.columns 
                 WHERE table_name='users' AND column_name='image') THEN
    ALTER TABLE users ADD COLUMN image TEXT;
  END IF;
END $$;

-- Step 2: Make email NOT NULL if it isn't already
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM information_schema.columns 
             WHERE table_name='users' AND column_name='email' AND is_nullable='YES') THEN
    ALTER TABLE users ALTER COLUMN email SET NOT NULL;
  END IF;
END $$;

-- Step 3: Create accounts table (for OAuth providers)
CREATE TABLE IF NOT EXISTS accounts (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  type VARCHAR(255) NOT NULL,
  provider VARCHAR(255) NOT NULL,
  provider_account_id VARCHAR(255) NOT NULL,
  refresh_token TEXT,
  access_token TEXT,
  expires_at BIGINT,
  token_type VARCHAR(255),
  scope TEXT,
  id_token TEXT,
  session_state TEXT,
  UNIQUE(provider, provider_account_id)
);

-- Step 4: Create sessions table
CREATE TABLE IF NOT EXISTS sessions (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  session_token VARCHAR(255) UNIQUE NOT NULL,
  user_id UUID NOT NULL REFERENCES users(id) ON DELETE CASCADE,
  expires TIMESTAMP WITH TIME ZONE NOT NULL
);

-- Step 5: Create verification_tokens table
CREATE TABLE IF NOT EXISTS verification_tokens (
  identifier VARCHAR(255) NOT NULL,
  token VARCHAR(255) NOT NULL,
  expires TIMESTAMP WITH TIME ZONE NOT NULL,
  PRIMARY KEY (identifier, token)
);

-- Step 6: Create indexes
CREATE INDEX IF NOT EXISTS idx_accounts_user_id ON accounts(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_user_id ON sessions(user_id);
CREATE INDEX IF NOT EXISTS idx_sessions_session_token ON sessions(session_token);
