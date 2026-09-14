import { getPool, setCORS, parseQuery } from './_db.js';
import jwt from 'jsonwebtoken';
import { createPublicKey } from 'crypto';

function publicKeyFromJwk(key) {
  if (key?.x5c?.[0]) return `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
  if (key?.n && key?.e) return createPublicKey({ key: { kty: 'RSA', n: key.n, e: key.e }, format: 'jwk' }).export({ type: 'spki', format: 'pem' });
  return null;
}

let jwksCache = { keys: null, expires: 0 };

async function verifyNhostToken(token) {
  const subdomain = process.env.NHOST_SUBDOMAIN || 'ybgaidcwksqeuojraxoe';
  const region = process.env.NHOST_REGION || 'ap-southeast-1';
  const decoded = jwt.decode(token, { complete: true });
  if (!decoded) throw new Error('Invalid token');
  if (!jwksCache.keys || Date.now() > jwksCache.expires) {
    const resp = await fetch(`https://${subdomain}.auth.${region}.nhost.run/v1/.well-known/jwks.json`);
    if (resp.ok) { const d = await resp.json(); jwksCache = { keys: d.keys, expires: Date.now() + 3600000 }; }
  }
  const keys = jwksCache.keys || [];
  const key = keys.find(k => k.kid === decoded.header.kid) || keys[0];
  if (!key) throw new Error('No matching key');
  const publicKey = publicKeyFromJwk(key);
  if (!publicKey) throw new Error('Cannot build public key');
  return jwt.verify(token, publicKey, { algorithms: ['RS256', 'RS384', 'RS512'] });
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const params = parseQuery(req);

  if (req.method === 'GET' && params.action === 'me') {
    res.status(200).json({ id: 'admin-1', email: 'admin@bridgecollectiveopport.org', full_name: 'Admin', role: 'admin', created_date: new Date().toISOString() });
    return;
  }

  if (req.method === 'POST') {
    res.status(501).json({ error: 'Sign-in is handled by Nhost Auth from the frontend.' });
    return;
  }

  res.status(405).json({ error: 'Method not allowed' });
}
