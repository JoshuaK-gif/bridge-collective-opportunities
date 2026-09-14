import { getPool, setCORS, readBody } from './_db.js';
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

async function requireAdmin(req) {
  const header = req.headers?.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const decoded = await verifyNhostToken(header.split(' ')[1]);
    const nhostId = decoded?.sub || '';
    if (!nhostId) return null;
    const pool = getPool();
    const result = await pool.query('SELECT id, email, role FROM users WHERE nhost_id = $1', [nhostId]);
    if (result.rows.length && result.rows[0].role === 'admin') return result.rows[0];
    return null;
  } catch { return null; }
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    if (req.method === 'GET') {
      const url = new URL(req.url, `https://${req.headers.host}`);
      const resource = url.searchParams.get('resource');
      const action = url.searchParams.get('action');

      if (resource === 'newsletter' && action === 'status') {
        const admin = await requireAdmin(req);
        if (!admin) { res.status(401).json({ error: 'Unauthorized' }); return; }
        const pool = getPool();
        const result = await pool.query("SELECT value FROM site_settings WHERE key = 'last_newsletter_sent'");
        res.status(200).json(result.rows.length ? result.rows[0].value : null);
        return;
      }

      res.status(404).json({ error: 'Not found' });
      return;
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const { resource, action } = body;

      if (resource === 'reminder' && action === 'create') {
        const { email, opportunityId, opportunityTitle, deadline } = body;
        if (!email || !opportunityId || !opportunityTitle || !deadline) {
          res.status(400).json({ error: 'email, opportunityId, opportunityTitle, and deadline are required' });
          return;
        }
        const pool = getPool();
        const existing = await pool.query("SELECT value FROM site_settings WHERE key = 'reminders'");
        let reminders = [];
        if (existing.rows.length && existing.rows[0].value) {
          const raw = existing.rows[0].value;
          if (Array.isArray(raw)) reminders = raw;
          else if (typeof raw === 'string') { try { reminders = JSON.parse(raw) || []; } catch { reminders = []; } }
          if (!Array.isArray(reminders)) reminders = [];
        }
        reminders.push({
          id: `${opportunityId}-${Date.now()}`,
          email,
          opportunityId,
          opportunityTitle,
          deadline,
          createdAt: new Date().toISOString(),
          sent: false,
        });
        if (reminders.length > 100) reminders = reminders.slice(-100);
        await pool.query(
          "INSERT INTO site_settings (key, value, updated_at) VALUES ('reminders', $1, now()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()",
          [JSON.stringify(reminders)]
        );
        res.status(200).json({ success: true });
        return;
      }

      if (resource === 'newsletter' && (action === 'send' || action === 'test')) {
        const admin = await requireAdmin(req);
        if (!admin) { res.status(401).json({ error: 'Unauthorized' }); return; }
        res.status(200).json({ success: true, message: 'Newsletter functionality requires Nhost functions.' });
        return;
      }

      res.status(404).json({ error: 'Unknown resource/action' });
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Outreach API error:', error);
    res.status(500).json({ error: error.message });
  }
}
