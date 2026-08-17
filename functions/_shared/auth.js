/**
 * Auth for Nhost Functions (consolidated backend) — Nhost Auth.
 *
 * The frontend signs in directly with Nhost Auth (email/password) and sends
 * the Nhost access token as `Authorization: Bearer <token>`. Functions verify
 * the JWT with the project's JWT secret (NHOST_JWT_SECRET is injected
 * automatically into Nhost Functions) and map the user to the app's `users`
 * table by email, which holds the `role` used by requireAdmin.
 *
 * Falls back to JWT_SECRET (the old server's custom secret) so locally-signed
 * tokens keep working during transition.
 */
import jwt from 'jsonwebtoken';
import { createPublicKey } from 'crypto';
import { query } from './db.js';

function getJwtSecret() {
  const raw = process.env.NHOST_JWT_SECRET || process.env.JWT_SECRET || process.env.HASURA_GRAPHQL_JWT_SECRET;
  if (!raw) throw new Error('JWT secret is not set');
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

let jwksCache = null;

/** Build a PEM public key from a JWKS key (supports x5c certs and n/e RSA). */
function publicKeyFromJwk(key) {
  if (key?.x5c?.[0]) {
    return `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
  }
  if (key?.n && key?.e) {
    return createPublicKey({ key: { kty: 'RSA', n: key.n, e: key.e }, format: 'jwk' }).export({ type: 'spki', format: 'pem' });
  }
  return null;
}

/**
 * Verify a Nhost JWT. Tries the symmetric secret first (HS256 projects;
 * NHOST_JWT_SECRET is injected into Functions), then falls back to the JWKS
 * endpoint for asymmetric-key projects (RS256/384/512).
 */
export async function verifyToken(token) {
  try {
    return jwt.verify(token, getJwtSecret());
  } catch (err) {
    if (err?.name === 'TokenExpiredError') throw err;
    // Symmetric verify failed — try JWKS (asymmetric-key projects).
    const subdomain = process.env.NHOST_SUBDOMAIN;
    const region = process.env.NHOST_REGION;
    if (!subdomain || !region) throw err;
    const jwksUri = `https://${subdomain}.auth.${region}.nhost.run/v1/.well-known/jwks.json`;
    const resp = await fetch(jwksUri);
    if (!resp.ok) throw err;
    const { keys } = await resp.json();
    const header = jwt.decode(token, { complete: true })?.header;
    const key = keys?.find(k => k.kid === header?.kid) || keys?.[0];
    const publicKey = publicKeyFromJwk(key);
    if (!publicKey) throw err;
    return jwt.verify(token, publicKey, { algorithms: ['RS256', 'RS384', 'RS512'] });
  }
}

/** Nhost JWT sub = the Nhost Auth user id (auth.users.id). */
function nhostUserIdFromToken(decoded) {
  const hasura = decoded?.['https://hasura.io/jwt/claims'];
  return hasura?.['x-hasura-user-id'] || decoded?.sub || '';
}

/** Returns the user row, or null after sending 401/403. */
export async function requireAuth(req, res) {
  const header = req.headers?.authorization;
  if (!header || !header.startsWith('Bearer ')) {
    res.status(401).json({ error: 'No token provided' });
    return null;
  }
  try {
    const decoded = await verifyToken(header.split(' ')[1]);

    // Nhost Auth flow: the token's sub is the Nhost Auth user id. Map it to
    // the app users table (source of role) via the nhost_id column.
    const nhostId = nhostUserIdFromToken(decoded);
    if (nhostId) {
      const result = await query(
        'SELECT id, email, full_name, role, created_date FROM users WHERE nhost_id = $1',
        [nhostId]
      );
      if (result.rows.length) return result.rows[0];
      // Nhost user without an app row — let them through as a normal user.
      return { id: decoded.sub, email: decoded.email || '', full_name: '', role: 'user', created_date: null };
    }

    // Legacy custom-JWT flow: lookup by id.
    const userId = decoded.id || decoded.sub;
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
    res.status(401).json({
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
