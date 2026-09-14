import jwt from 'jsonwebtoken';
import { createPublicKey } from 'crypto';
import { getPool, setCORS } from './_db.js';
import {
  getSmtpConfig,
  sendEmail,
  sendViaBrevoApi,
  buildTransport,
  stripHtml,
  escapeHtml,
  buildEmailHeader,
} from './_email.js';

const pool = getPool();

function publicKeyFromJwk(key) {
  if (key?.x5c?.[0]) return `-----BEGIN CERTIFICATE-----\n${key.x5c[0]}\n-----END CERTIFICATE-----`;
  if (key?.n && key?.e) return createPublicKey({ key: { kty: 'RSA', n: key.n, e: key.e }, format: 'jwk' }).export({ type: 'spki', format: 'pem' });
  return null;
}

let jwksCache = { keys: null, expires: 0 };

async function requireAdmin(req) {
  const header = req.headers?.authorization;
  if (!header || !header.startsWith('Bearer ')) return null;
  try {
    const decoded = jwt.decode(header.split(' ')[1], { complete: true });
    if (!decoded) return null;
    if (!jwksCache.keys || Date.now() > jwksCache.expires) {
      const subdomain = process.env.NHOST_SUBDOMAIN || 'ybgaidcwksqeuojraxoe';
      const region = process.env.NHOST_REGION || 'ap-southeast-1';
      const resp = await fetch(`https://${subdomain}.auth.${region}.nhost.run/v1/.well-known/jwks.json`);
      if (resp.ok) { const d = await resp.json(); jwksCache = { keys: d.keys, expires: Date.now() + 3600000 }; }
    }
    const keys = jwksCache.keys || [];
    const key = keys.find(k => k.kid === decoded.header.kid) || keys[0];
    if (!key) return null;
    const publicKey = publicKeyFromJwk(key);
    if (!publicKey) return null;
    const verified = jwt.verify(header.split(' ')[1], publicKey, { algorithms: ['RS256', 'RS384', 'RS512'] });
    const nhostId = verified?.sub || '';
    if (!nhostId) return null;
    const result = await pool.query('SELECT id, email, role FROM users WHERE nhost_id = $1', [nhostId]);
    if (result.rows.length && result.rows[0].role === 'admin') return result.rows[0];
    return null;
  } catch { return null; }
}

function buildNewsletterHtml(opportunities) {
  const itemsHtml = opportunities.map(o => `
    <tr>
      <td style="padding:16px 0;border-bottom:1px solid #e5e7eb;">
        <table width="100%">
          <tr>
            ${o.image_url ? `<td width="96" style="padding-right:14px;vertical-align:top;">
              <img src="${escapeHtml(o.image_url)}" alt="" style="width:96px;height:64px;object-fit:cover;border-radius:8px;" />
            </td>` : ''}
            <td style="vertical-align:top;">
              <a href="https://bridgecollectiveopport.org/opportunities/${escapeHtml(o.id)}" style="font-size:15px;font-weight:700;color:#065f46;text-decoration:none;line-height:1.3;">${escapeHtml(o.title)}</a>
              <p style="margin:4px 0 0;font-size:13px;color:#555;line-height:1.4;">${escapeHtml(stripHtml(o.description).slice(0, 150))}...</p>
              <span style="display:inline-block;margin-top:6px;padding:2px 10px;border-radius:12px;font-size:11px;font-weight:600;background:#d1fae5;color:#065f46;">${escapeHtml(o.category || 'Opportunity')}</span>
            </td>
          </tr>
        </table>
      </td>
    </tr>
  `).join('');

  return `
<!DOCTYPE html>
<html>
<head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"></head>
<body style="margin:0;padding:0;background:#f0faf0;font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;">
  <table width="100%" cellpadding="0" cellspacing="0"><tr><td align="center" style="padding:24px 16px;">
    <table width="600" cellpadding="0" cellspacing="0" style="max-width:600px;width:100%;background:#fff;border-radius:16px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,.08);">
      ${buildEmailHeader('Daily Opportunities Update')}
      <tr><td style="padding:20px 32px 8px;font-size:13px;color:#6b7280;">Latest opportunities curated for you</td></tr>
      <tr><td style="padding:0 32px;">
        <table width="100%" cellpadding="0" cellspacing="0">${itemsHtml}</table>
      </td></tr>
      ${opportunities.length === 0 ? `<tr><td style="padding:32px;text-align:center;font-size:14px;color:#888;">No new opportunities today. Check back tomorrow!</td></tr>` : ''}
      <tr><td style="padding:20px 32px;background:#f0faf0;text-align:center;font-size:11px;color:#6b7280;">
        <p style="margin:0;">Bridge Collective Opportunities (BCO) — Connecting youth to life-changing opportunities</p>
      </td></tr>
    </table>
  </td></tr></table>
 </body>
</html>`;
}

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const admin = await requireAdmin(req);
    if (!admin) { res.status(401).json({ error: 'Unauthorized' }); return; }

    const url = new URL(req.url, `https://${req.headers.host}`);
    // Rewrites map /api/newsletter/{status,test,send} -> /api/newsletter?action=...
    // so prefer the query param and fall back to the path (local dev / direct calls).
    const action = url.searchParams.get('action') || url.pathname.replace(/^\/api\/newsletter\/?/, '').replace(/\/$/, '') || 'status';

    // GET /api/newsletter/status
    if (req.method === 'GET' && action === 'status') {
      const result = await pool.query("SELECT value FROM site_settings WHERE key = 'last_newsletter_sent'");
      res.status(200).json(result.rows.length ? result.rows[0].value : null);
      return;
    }

    if (req.method !== 'POST') { res.status(405).json({ error: 'Method not allowed' }); return; }

    const chunks = [];
    for await (const chunk of req) chunks.push(chunk);
    let body = {};
    try { body = JSON.parse(Buffer.concat(chunks).toString()); } catch {}

    // POST /api/newsletter/test — send a test email with the provided config
    if (action === 'test') {
      const { to, config } = body;
      if (!to) { res.status(400).json({ error: 'Recipient email is required' }); return; }
      if (!config) { res.status(400).json({ error: 'SMTP config is required' }); return; }
      if (config?.api_key) {
        try {
          const result = await sendViaBrevoApi(config, { to, subject: 'Test email from Bridge Collective', html: '<h1>Test Email</h1><p>Your Brevo API configuration is working correctly.</p>' });
          res.status(200).json(result);
        } catch (err) {
          res.status(200).json({ success: false, reason: err.message });
        }
        return;
      }
      const transporter = buildTransport(config);
      if (!transporter) { res.status(200).json({ success: false, reason: 'Invalid SMTP config' }); return; }
      try {
        await transporter.sendMail({
          from: `"${config.from_name || 'Bridge Collective'}" <${config.from_email || config.user}>`,
          to,
          subject: 'Test email from Bridge Collective',
          html: '<h1>Test Email</h1><p>Your SMTP configuration is working correctly.</p>',
        });
        res.status(200).json({ success: true });
      } catch (err) {
        res.status(200).json({ success: false, reason: err.message });
      }
      return;
    }

    // POST /api/newsletter/send — send the daily newsletter (batched, 50 at a time)
    if (action === 'send') {
      const batchSize = Math.min(parseInt(body.batchSize, 10) || 50, 100);
      const offset = parseInt(body.offset, 10) || 0;

      const smtpConfig = await getSmtpConfig();
      if (!smtpConfig || (!smtpConfig.host && !smtpConfig.api_key)) {
        res.status(200).json({ sent: 0, skipped: true, message: 'SMTP not configured' });
        return;
      }

      const subsResult = await pool.query(
        "SELECT id, email FROM subscribers WHERE is_active = true AND unsubscribed_at IS NULL ORDER BY created_date DESC LIMIT $1 OFFSET $2",
        [batchSize, offset]
      );
      if (!subsResult.rows.length) {
        res.status(200).json({ sent: 0, batch: true, done: true });
        return;
      }
      const done = subsResult.rows.length < batchSize;

      const oppResult = await pool.query(
        "SELECT id, title, description, image_url, category, created_date FROM opportunities WHERE status = 'active' ORDER BY created_date DESC LIMIT 10"
      );
      const opps = oppResult?.rows || [];

      let sent = 0;
      let failed = 0;
      for (const sub of subsResult.rows) {
        const unsubscribeUrl = `https://bridgecollectiveopport.org/api/unsubscribe?email=${encodeURIComponent(sub.email)}&id=${sub.id}`;
        const html = buildNewsletterHtml(opps);
        const text = opps.map(o => `- ${o.title}: https://bridgecollectiveopport.org/opportunities/${o.id}`).join('\n');
        const result = await sendEmail({
          to: sub.email,
          subject: `Daily Opportunities — ${new Date().toLocaleDateString('en-US', { month: 'long', day: 'numeric', year: 'numeric' })}`,
          html,
          text,
        });
        if (result.success) sent++;
        else failed++;
      }

      if (sent > 0) {
        await pool.query(
          "INSERT INTO site_settings (key, value, updated_at) VALUES ('last_newsletter_sent', $1, now()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()",
          [JSON.stringify({ sent_at: new Date().toISOString(), count: sent, failed })]
        );
      }

      res.status(200).json({ sent, failed, total: subsResult.rows.length, offset, done });
      return;
    }

    res.status(404).json({ error: `Unknown newsletter action: ${action}` });
  } catch (error) {
    console.error('Newsletter API error:', error);
    res.status(500).json({ error: error.message });
  }
}