import { setCORS, parseQuery } from './_db.js';
import { requireAuth, AuthError } from './_auth.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const params = parseQuery(req);

  // `/api/auth/me` is served through a rewrite to `/api/auth?action=me`. Vercel
  // does not always forward the rewritten query into `req.url`, so fall back to
  // the last path segment (`me`, `logout`, ...) when no action param is present.
  const pathSegment = String(req.url || '').split('?')[0].replace(/\/+$/, '').split('/').pop();
  const action = params.action || (pathSegment && pathSegment !== 'auth' ? pathSegment : '');

  if (req.method === 'GET' && action === 'me') {
    try {
      const user = await requireAuth(req);
      res.status(200).json(user);
    } catch (err) {
      if (err instanceof AuthError) {
        res.status(err.status).json({ error: err.message });
        return;
      }
      // Anything else (DB down, bad DATABASE_URL, ...) is a server problem, not
      // a bad session — log it so it shows up in the Vercel runtime logs.
      console.error('Auth /me error:', err.message);
      res.status(500).json({ error: err.message });
    }
    return;
  }

  if (req.method === 'POST') {
    res.status(501).json({ error: 'Sign-in is handled by Nhost Auth from the frontend.' });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
