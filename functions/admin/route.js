/**
 * /v1/admin — settings + subscribers + messages + upload signatures.
 *
 * Uploads moved to direct-to-Cloudinary browser uploads (Nhost Functions can't
 * reliably receive multipart). The client asks for a signature, then uploads
 * the file straight to Cloudinary.
 *
 * GET  /v1/admin?resource=settings          (admin)
 * GET  /v1/admin?resource=setting&key=      (public for PUBLIC_SETTINGS, else admin)
 * GET  /v1/admin?resource=subscribers       (admin)
 * GET  /v1/admin?resource=messages          (admin)
 *
 * POST /v1/admin  { resource: 'setting', action: 'update', key, value }
 * POST /v1/admin  { resource: 'subscriber', action: 'subscribe'|'delete'|'bulk-delete', ... }
 * POST /v1/admin  { resource: 'message', action: 'send'|'mark-read'|'delete'|'bulk-delete', ... }
 * POST /v1/admin  { resource: 'upload', action: 'signature', folder }
 */
import { query } from '../_shared/db.js';
import logger from '../_shared/logger.js';
import { requireAdmin, requireAuth } from '../_shared/auth.js';
import { AppError, handle } from '../_shared/errors.js';
import { parseWith, subscriberSchema, messageSchema } from '../_shared/validate.js';
import { sendEmail } from '../_shared/email.js';
import { createUploadSignature } from '../_shared/cloudinary.js';

const PUBLIC_SETTINGS = new Set(['site_name', 'site_description', 'site_logo', 'contact_email', 'cv_tips', 'ga_measurement_id']);

function sanitizeEmailHeader(value) {
  return (value || '').replace(/[\r\n]/g, ' ').trim();
}

function escapeHtml(str) {
  return (str || '').replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}

async function geoLookup(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return { city: '', country: '' };
  }
  try {
    const resp = await fetch(`https://ip-api.com/json/${ip}?fields=city,country`, { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      const data = await resp.json();
      return { city: data.city || '', country: data.country || '' };
    }
  } catch {}
  return { city: '', country: '' };
}

/* ---------------------------------- GET ---------------------------------- */

async function handleGet(req, res) {
  const q = req.query || {};
  const resource = q.resource;

  if (resource === 'settings') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await query('SELECT key, value FROM site_settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    return res.json(settings);
  }

  if (resource === 'setting') {
    if (!PUBLIC_SETTINGS.has(q.key)) {
      const admin = await requireAuth(req, res);
      if (!admin) return;
    }
    const result = await query('SELECT value FROM site_settings WHERE key = $1', [q.key]);
    if (!result.rows.length) throw new AppError(404, 'Setting not found');
    return res.json({ key: q.key, value: result.rows[0].value });
  }

  if (resource === 'subscribers') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await query('SELECT * FROM subscribers ORDER BY created_date DESC LIMIT 1000');
    return res.json(result.rows);
  }

  if (resource === 'messages') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await query('SELECT * FROM messages ORDER BY created_date DESC LIMIT 100');
    return res.json(result.rows);
  }

  throw new AppError(404, `Unknown resource: ${resource}`);
}

/* ---------------------------------- POST ---------------------------------- */

async function handleSettingAction(body, req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const { key, value } = body;
  if (!key) throw new AppError(400, 'key is required');
  if (value === undefined) throw new AppError(400, 'Value is required');
  await query(
    'INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()',
    [key, JSON.stringify(value)]
  );
  logger.info({ key }, 'Setting updated');
  return res.json({ success: true });
}

async function handleSubscriberAction(body, req, res) {
  const action = body.action;

  if (action === 'subscribe') {
    const parsed = parseWith(subscriberSchema, body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error, details: parsed.details });
    const { email, source_page, referrer } = parsed.data;

    const ip = req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || '';
    const ua = req.headers?.['user-agent'] || '';
    const geo = await geoLookup(ip);

    const existing = await query('SELECT id FROM subscribers WHERE email = $1', [email]);
    if (existing.rows.length) {
      await query(
        `UPDATE subscribers SET is_active = true, source_page = COALESCE(NULLIF($1,''), source_page),
         referrer = COALESCE(NULLIF($2,''), referrer), ip_address = COALESCE(NULLIF($3,''), ip_address),
         city = COALESCE(NULLIF($4,''), city), country = COALESCE(NULLIF($5,''), country),
         user_agent = COALESCE(NULLIF($6,''), user_agent)
         WHERE email = $7`,
        [source_page || '', referrer || '', ip, geo.city, geo.country, ua, email]
      );
      return res.json({ success: true, message: 'Already subscribed' });
    }

    await query(
      `INSERT INTO subscribers (email, source_page, referrer, ip_address, city, country, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [email, source_page || '', referrer || '', ip, geo.city, geo.country, ua]
    );
    logger.info({ subscriberEmail: email, source: source_page, country: geo.country }, 'New subscriber');
    return res.status(201).json({ success: true });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (action === 'delete') {
    const result = await query('DELETE FROM subscribers WHERE id = $1', [body.id]);
    if (!result.rowCount) throw new AppError(404, 'Subscriber not found');
    logger.info({ subscriberId: body.id }, 'Subscriber deleted');
    return res.json({ success: true });
  }

  if (action === 'bulk-delete') {
    const { ids } = body;
    if (!Array.isArray(ids) || !ids.length) throw new AppError(400, 'ids array is required');
    const result = await query('DELETE FROM subscribers WHERE id = ANY($1::uuid[])', [ids]);
    logger.info({ count: result.rowCount }, 'Bulk subscribers deleted');
    return res.json({ success: true, deleted: result.rowCount });
  }

  throw new AppError(404, `Unknown subscriber action: ${action}`);
}

async function handleMessageAction(body, req, res) {
  const action = body.action;

  if (action === 'send') {
    const parsed = parseWith(messageSchema, body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error, details: parsed.details });
    const { name, email, subject, message } = parsed.data;
    const result = await query(
      'INSERT INTO messages (name, email, subject, message) VALUES ($1,$2,$3,$4) RETURNING id',
      [name, email, subject, message]
    );
    logger.info({ messageId: result.rows[0].id }, 'Message received');

    const adminResult = await query("SELECT email FROM users WHERE role = 'admin' ORDER BY created_date ASC");
    if (adminResult.rows.length) {
      for (const admin of adminResult.rows) {
        sendEmail({
          to: admin.email,
          subject: `[Bridge Jobs] ${sanitizeEmailHeader(subject)}`,
          html: `
            <h2>New Contact Form Submission</h2>
            <table style="border-collapse:collapse;width:100%;max-width:500px;">
              <tr><td style="padding:8px;font-weight:600;color:#555;border-bottom:1px solid #eee;">Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(name)}</td></tr>
              <tr><td style="padding:8px;font-weight:600;color:#555;border-bottom:1px solid #eee;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;"><a href="mailto:${escapeHtml(email)}">${escapeHtml(email)}</a></td></tr>
              <tr><td style="padding:8px;font-weight:600;color:#555;border-bottom:1px solid #eee;">Subject</td><td style="padding:8px;border-bottom:1px solid #eee;">${escapeHtml(subject)}</td></tr>
            </table>
            <h3 style="margin-top:16px;">Message</h3>
            <p style="background:#f5f5f5;padding:12px;border-radius:6px;white-space:pre-wrap;">${escapeHtml(message)}</p>
            <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
            <p style="font-size:12px;color:#999;">View in admin: https://bridgecollectiveopport.org/admin-bridgejobs/messages</p>
          `,
        }).catch(err => logger.warn({ err: err.message }, 'Failed to notify admin of message'));
      }
    }
    return res.status(201).json({ id: result.rows[0].id, success: true });
  }

  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (action === 'mark-read') {
    const result = await query('UPDATE messages SET is_read = true WHERE id = $1', [body.id]);
    if (!result.rowCount) throw new AppError(404, 'Message not found');
    return res.json({ success: true });
  }

  if (action === 'delete') {
    const result = await query('DELETE FROM messages WHERE id = $1', [body.id]);
    if (!result.rowCount) throw new AppError(404, 'Message not found');
    logger.info({ messageId: body.id }, 'Message deleted');
    return res.json({ success: true });
  }

  if (action === 'bulk-delete') {
    const { ids } = body;
    if (!Array.isArray(ids) || !ids.length) throw new AppError(400, 'ids array is required');
    const result = await query('DELETE FROM messages WHERE id = ANY($1::uuid[])', [ids]);
    logger.info({ count: result.rowCount }, 'Bulk messages deleted');
    return res.json({ success: true, deleted: result.rowCount });
  }

  throw new AppError(404, `Unknown message action: ${action}`);
}

async function handleUploadAction(body, req, res) {
  const action = body.action;

  if (action === 'signature') {
    try {
      const sig = createUploadSignature({ folder: body.folder || 'bridge-jobs' });
      return res.json(sig);
    } catch (err) {
      logger.error({ err: err.message }, 'Upload signature failed');
      return res.status(500).json({ error: 'Upload is not configured. Ask the admin to add Cloudinary keys.' });
    }
  }

  throw new AppError(404, `Unknown upload action: ${action}`);
}

export default handle(async (req, res) => {
  if (req.method === 'GET') return handleGet(req, res);

  if (req.method === 'POST') {
    const body = req.body || {};
    const resource = body.resource;

    if (resource === 'setting') return handleSettingAction(body, req, res);
    if (resource === 'subscriber') return handleSubscriberAction(body, req, res);
    if (resource === 'message') return handleMessageAction(body, req, res);
    if (resource === 'upload') return handleUploadAction(body, req, res);
    throw new AppError(404, `Unknown resource: ${resource}`);
  }

  res.status(405).json({ error: 'Method not allowed' });
});
