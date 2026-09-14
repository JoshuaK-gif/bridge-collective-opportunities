import jwt from 'jsonwebtoken';
import { createRemoteJWKSet, jwtVerify } from 'jose';
import pool from './lib/db.js';
import logger from './lib/logger.js';

const NHOST_AUTH_URL =
  process.env.NHOST_AUTH_URL ||
  'https://ybgaidcwksqeuojraxoe.auth.ap-southeast-1.nhost.run/v1';

const NHOST_ADMIN_SECRET = process.env.NHOST_ADMIN_SECRET;
const SECRET = process.env.JWT_SECRET;
const jwks = createRemoteJWKSet(new URL(`${NHOST_AUTH_URL}/.well-known/jwks.json`));

export function generateToken(user) {
  return jwt.sign(
    { id: user.id, email: user.email, role: user.role },
    SECRET,
    { expiresIn: '7d' }
  );
}

let emailCache = new Map();

async function fetchNhostEmail(userId) {
  if (emailCache.has(userId)) return emailCache.get(userId);
  const res = await fetch(`${NHOST_AUTH_URL}/user`, {
    headers: { 'x-hasura-admin-secret': NHOST_ADMIN_SECRET },
  });
  const users = await res.json();
  const match = users.find(u => u.id === userId);
  if (!match?.email) return null;
  emailCache.set(userId, match.email);
  return match.email;
}

export async function authenticate(req, res, next) {
  const header = req.headers.authorization;
  if (!header || !header.startsWith('Bearer '))
    return res.status(401).json({ error: 'No token provided' });

  const token = header.split(' ')[1];

  try {
    const { payload } = await jwtVerify(token, jwks);

    // Nhost JWT: use sub (Nhost user ID) to look up in local DB via nhost_id
    const nhostId = payload.sub || '';
    if (nhostId) {
      const result = await pool.query(
        'SELECT id, email, full_name, role, created_date FROM users WHERE nhost_id = $1',
        [nhostId]
      );
      if (result.rows.length) {
        req.user = result.rows[0];
        return next();
      }
    }

    // Fallback: try email from JWT payload
    let email = payload.email;
    if (!email && nhostId) {
      email = await fetchNhostEmail(nhostId);
    }
    if (email) {
      const result = await pool.query(
        'SELECT id, email, full_name, role, created_date FROM users WHERE email = $1',
        [email]
      );
      if (result.rows.length) {
        req.user = result.rows[0];
        return next();
      }
    }

    return res.status(401).json({ error: 'Could not resolve user' });
  } catch (err) {
    logger.error({ err: err.message }, 'Nhost auth failed');
    if (err.code === 'ERR_JWT_EXPIRED') return res.status(401).json({ error: 'Token expired' });
    return res.status(401).json({ error: 'Invalid token' });
  }
}
