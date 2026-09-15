import jwt from 'jsonwebtoken';
import { createPublicKey } from 'crypto';
import { getPool } from './_db.js';

function publicKeyFromJwk(key) {
  if (key?.x5c?.[0]) return `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
  if (key?.n && key?.e) return createPublicKey({ key: { kty: 'RSA', n: key.n, e: key.e }, format: 'jwk' }).export({ type: 'spki', format: 'pem' });
  return null;
}

let jwksCache = { keys: null, expires: 0 };

export async function verifyNhostToken(token) {
  const subdomain = process.env.NHOST_SUBDOMAIN || 'ybgaidcwksqeuojraxoe';
  const region = process.env.NHOST_REGION || 'ap-southeast-1';
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded) throw new AuthError('Invalid token');

  if (!jwksCache.keys || Date.now() > jwksCache.expires) {
    const resp = await fetch(`https://${subdomain}.auth.${region}.nhost.run/v1/.well-known/jwks.json`);
    if (resp.ok) {
      const d = await resp.json();
      jwksCache = { keys: d.keys, expires: Date.now() + 3600000 };
    }
  }

  const keys = jwksCache.keys || [];
  const key = keys.find(k => k.kid === decoded.header.kid) || keys[0];
  if (!key) throw new AuthError('No matching key');

  const publicKey = publicKeyFromJwk(key);
  if (!publicKey) throw new AuthError('Cannot build public key');

  try {
    return jwt.verify(token, publicKey, { algorithms: ['RS256', 'RS384', 'RS512'] });
  } catch (err) {
    // A bad signature or algorithm is a failed *session*, not a server fault, so
    // surface it as 401 (rather than letting the raw jwt error become a 500).
    if (err?.name === 'TokenExpiredError') throw new AuthError('Token expired');
    if (err?.name === 'NotBeforeError') throw new AuthError('Token not active yet');
    console.warn('Nhost token rejected:', err.message);
    throw new AuthError('Invalid token');
  }
}

function extractNhostUserId(decoded) {
  const hasura = decoded?.['https://hasura.io/jwt/claims'];
  return hasura?.['x-hasura-user-id'] || decoded?.sub || '';
}

export class AuthError extends Error {
  constructor(message, status = 401) {
    super(message);
    this.name = 'AuthError';
    this.status = status;
  }
}

const USER_COLS = 'id, email, full_name, role, created_date';

/**
 * Look a user up by Nhost user id (`sub` claim).
 *
 * `users.nhost_id` is optional — older deployments only have the email column,
 * so a missing column (Postgres 42703) must not fail the request.
 */
async function findUserByNhostId(pool, nhostId) {
  if (!nhostId) return null;
  try {
    const result = await pool.query(`SELECT ${USER_COLS} FROM users WHERE nhost_id = $1`, [nhostId]);
    return result.rows[0] || null;
  } catch (err) {
    if (err.code === '42703') return null; // undefined_column — not migrated yet
    throw err;
  }
}

/** Look a user up by the email claim so role mapping works on any schema. */
async function findUserByEmail(pool, email) {
  if (!email) return null;
  const result = await pool.query(
    `SELECT ${USER_COLS} FROM users WHERE lower(email) = lower($1)`,
    [email]
  );
  return result.rows[0] || null;
}

/** Best-effort backfill so later sign-ins can use the fast nhost_id path. */
async function linkNhostId(pool, userId, nhostId) {
  if (!userId || !nhostId) return;
  try {
    await pool.query('UPDATE users SET nhost_id = $1 WHERE id = $2 AND nhost_id IS NULL', [nhostId, userId]);
  } catch (err) {
    if (err.code !== '42703') console.warn('Could not link nhost_id:', err.message);
  }
}

/**
 * Verify the Authorization header and return the user row from the DB.
 * Throws AuthError if token is missing/invalid.
 */
export async function requireAuth(req) {
  const header = req.headers?.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    throw new AuthError('No token provided');
  }

  const decoded = await verifyNhostToken(header.split(' ')[1]);
  const pool = getPool();
  const nhostId = extractNhostUserId(decoded);
  const email = decoded.email;

  // Preferred: the Nhost user id we stored on first sign-in.
  const byNhostId = await findUserByNhostId(pool, nhostId);
  if (byNhostId) return byNhostId;

  // Fallback: match the verified email claim against the app's users table.
  const byEmail = await findUserByEmail(pool, email);
  if (byEmail) {
    await linkNhostId(pool, byEmail.id, nhostId);
    return byEmail;
  }

  // Nhost user without a local app row — treat as a normal user.
  console.warn(`No users row matches Nhost account ${email || nhostId || 'unknown'} — defaulting to role "user"`);
  return {
    id: decoded.sub,
    email: email || '',
    full_name: '',
    role: 'user',
    created_date: null,
  };
}

/**
 * Verify auth and require admin role. Throws AuthError if not admin.
 */
export async function requireAdmin(req) {
  const user = await requireAuth(req);
  if (user.role !== 'admin') {
    throw new AuthError('Forbidden', 403);
  }
  return user;
}
