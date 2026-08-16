/**
 * POST /v1/auth            { action: 'login', email, password } → { access_token }
 * GET  /v1/auth?action=me  (Bearer token) → user profile
 */
import bcrypt from 'bcryptjs';
import { query } from '../_shared/db.js';
import logger from '../_shared/logger.js';
import { signToken, requireAuth } from '../_shared/auth.js';
import { AppError, handle } from '../_shared/errors.js';

const MAX_ATTEMPTS = 5;
const LOCKOUT_MINUTES = 30;

export default handle(async (req, res) => {
  if (req.method === 'GET' && req.query?.action === 'me') {
    const user = await requireAuth(req, res);
    if (!user) return;
    return res.json(user);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  const body = req.body || {};
  const action = body.action || 'login';

  if (action === 'login') {
    const { email, password } = body;
    if (!email || !password) throw new AppError(400, 'Email and password required');

    const result = await query('SELECT * FROM users WHERE email = $1', [email]);
    const user = result.rows[0];

    if (user && user.locked_until && new Date(user.locked_until) > new Date()) {
      const remaining = Math.ceil((new Date(user.locked_until) - new Date()) / 60000);
      throw new AppError(429, `Account locked. Try again in ${remaining} minute(s).`);
    }

    if (!user || !(await bcrypt.compare(password, user.password))) {
      if (user) {
        const attempts = (user.failed_attempts || 0) + 1;
        if (attempts >= MAX_ATTEMPTS) {
          await query(
            "UPDATE users SET failed_attempts = $1, locked_until = now() + interval '30 minutes' WHERE id = $2",
            [attempts, user.id]
          );
        } else {
          await query('UPDATE users SET failed_attempts = $1 WHERE id = $2', [attempts, user.id]);
        }
      }
      throw new AppError(401, 'Invalid email or password');
    }

    await query('UPDATE users SET failed_attempts = 0, locked_until = NULL WHERE id = $1', [user.id]);
    logger.info({ userId: user.id }, 'User logged in');
    return res.json({ access_token: signToken(user) });
  }

  throw new AppError(404, `Unknown action: ${action}`);
});
