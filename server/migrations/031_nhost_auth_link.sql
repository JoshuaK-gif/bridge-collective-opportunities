-- Link app users to Nhost Auth users (requireAuth maps JWT sub → users.nhost_id).
ALTER TABLE users ADD COLUMN IF NOT EXISTS nhost_id UUID UNIQUE;
CREATE INDEX IF NOT EXISTS idx_users_nhost_id ON users(nhost_id);
