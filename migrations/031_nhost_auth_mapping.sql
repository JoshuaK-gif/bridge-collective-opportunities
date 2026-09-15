-- 031_nhost_auth_mapping.sql
--
-- Sign-in is handled by Nhost Auth; the app's `users` table is the source of the
-- `role` used by requireAdmin() (api/_auth.js). Two things have to line up:
--
--   1. `nhost_id` maps a Nhost account to an app user by id. api/_auth.js still
--      works without this column (it falls back to matching the verified email),
--      but the column lets it skip the email lookup and stops the row drifting
--      if the Nhost email is ever changed.
--
--   2. An app user row must exist for the *Nhost* email of every admin.
--      Without it requireAuth() returns role 'user', so /admin-bridgejobs
--      redirects straight back to '/'.
--
-- Update the email below if the Nhost Auth admin account differs.

ALTER TABLE users ADD COLUMN IF NOT EXISTS nhost_id TEXT;

CREATE UNIQUE INDEX IF NOT EXISTS users_nhost_id_key
  ON users (nhost_id) WHERE nhost_id IS NOT NULL;

-- The password column is NOT NULL but is no longer used for sign-in (Nhost Auth
-- verifies credentials). The placeholder below is a bcrypt hash so that any
-- legacy bcrypt.compare() call still gets a clean "no match" instead of an
-- invalid-hash error.
INSERT INTO users (email, password, full_name, role)
VALUES (
  'kamulegeyajoshua534@gmail.com',
  '$2a$10$92IXUNpkjO0rOQ5byMi.Ye4oKoEa3Ro9llC/.og/at2.uheWG/igi',
  'Joshua Kamulegeya',
  'admin'
)
ON CONFLICT (email) DO UPDATE SET role = 'admin';

-- Promote any existing account that should already be an admin.
UPDATE users SET role = 'admin' WHERE email = 'admin@bridgecollective.com';
