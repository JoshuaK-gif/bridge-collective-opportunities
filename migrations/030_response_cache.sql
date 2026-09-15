-- Persistent response cache for Nhost Functions (see functions/_shared/cache.js).
CREATE TABLE IF NOT EXISTS response_cache (
  key        text PRIMARY KEY,
  value      jsonb NOT NULL,
  expires_at timestamptz NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_response_cache_expires_at ON response_cache(expires_at);