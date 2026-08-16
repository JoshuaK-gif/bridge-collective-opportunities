/**
 * Auth for Nhost Functions (consolidated backend).
 *
 * Keeps the app's existing custom JWT flow (login → token signed with
 * JWT_SECRET, verified here) so the frontend works identically to localhost.
 * Falls back to the Nhost JWT secret (NHOST_JWT_SECRET) for future Nhost Auth
 * tokens. JWT_SECRET must be set as a custom env var on Nhost (same value the
 * old server used).
 */
import jwt from 'jsonwebtoken';
import { query } from './db.js';

function getJwtSecret() {
  const raw = process.env.JWT_SECRET || process.env.NHOST_JWT_SECRET;
  if (!raw) throw new Error('JWT_SECRET is not set');
  try {
    return JSON.parse(raw).key;
  } catch {
    return raw;
  }
}

export function signToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    getJwtSecret(),
    { expiresIn: '7d' }
  );
}

export function verifyToken(token) {
  return jwt.verify(token, getJwtSecret());
}

/** Returns the user row, or null after sending 401/403. */
export async function requireAuth(req, res) {
  const header = req.headers?.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return null;
  }
  try {
    const decoded = verifyToken(header.split(' ')[1]);
    const userId = decoded.id || decoded.sub || decoded['x-hasura-user-id'];
    const result = await query(
      'SELECT id, email, full_name, role, created_date FROM users WHERE id = $1',
      [userId]
    );
    if (!result.rows.length) {
      res.status(401).json({ error: 'User not found' });
      return null;
    }
    return result.rows[0];
  } catch (err) {
    res.status(err?.name === 'TokenExpiredError' ? 401 : 401).json({
      error: err?.name === 'TokenExpiredError' ? 'Token expired' : 'Invalid token',
    });
    return null;
  }
}

/** Returns the user row if admin, otherwise null after sending 401/403. */
export async function requireAdmin(req, res) {
  const user = await requireAuth(req, res);
  if (!user) return null;
  if (user.role !== 'admin') {
    res.status(403).json({ error: 'Forbidden' });
    return null;
  }
  return user;
}

export default { requireAuth, requireAdmin, signToken, verifyToken };
