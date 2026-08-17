/**
 * /v1/auth — Nhost Auth integration.
 *
 * Sign-in now happens directly with Nhost Auth (email/password) from the
 * frontend — see src/api/client.js (NHOST_AUTH_URL). This function only
 * resolves the Nhost access token to the app's user profile (with role).
 *
 * GET /v1/auth?action=me  (Bearer Nhost token) → user profile
 */
import { requireAuth } from '../_shared/auth.js';
import { handle } from '../_shared/errors.js';

export default handle(async (req, res) => {
  if (req.method === 'GET' && req.query?.action === 'me') {
    const user = await requireAuth(req, res);
    if (!user) return;
    return res.json(user);
  }

  if (req.method === 'POST') {
    // Login moved to Nhost Auth (frontend signs in directly). Keep a stub so
    // any leftover client calls fail loudly instead of silently.
    return res.status(501).json({
      error: 'Sign-in is handled by Nhost Auth from the frontend. See src/api/client.js.',
    });
  }

  res.status(405).json({ error: 'Method not allowed' });
});
