-- Migration script to add OAuth state storage table
-- This allows us to complete OAuth flow even if user session expires

CREATE TABLE IF NOT EXISTS oauth_states (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  state_token VARCHAR(255) UNIQUE NOT NULL,
  code VARCHAR(255),
  access_token TEXT,
  refresh_token TEXT,
  athlete_id BIGINT,
  token_expires_at TIMESTAMP WITH TIME ZONE,
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  expires_at TIMESTAMP WITH TIME ZONE NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_oauth_states_state_token ON oauth_states(state_token);
CREATE INDEX IF NOT EXISTS idx_oauth_states_expires_at ON oauth_states(expires_at);

-- Clean up expired states (run periodically)
-- DELETE FROM oauth_states WHERE expires_at < NOW();
