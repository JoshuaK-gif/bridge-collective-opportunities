import { Router } from 'express';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';
import { AppError } from '../lib/errors.js';
import { createUploadSignature } from '../lib/cloudinary.js';

const router = Router();

const PUBLIC_SETTINGS = new Set(['site_name', 'site_description', 'site_logo', 'contact_email', 'cv_tips', 'ga_measurement_id']);

// GET /api/admin?resource=settings (admin)
// GET /api/admin?resource=setting&key= (public for PUBLIC_SETTINGS, else admin)
// GET /api/admin?resource=subscribers (admin)
// GET /api/admin?resource=messages (admin)
router.get('/', async (req, res, next) => {
  try {
    const { resource, key } = req.query;

    if (resource === 'settings') {
      if (!req.headers.authorization) throw new AppError(401, 'Authentication required');
      await new Promise((resolve, reject) => {
        authenticate(req, res, (err) => err ? reject(err) : resolve());
      });
      if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
      const result = await pool.query('SELECT key, value FROM site_settings');
      const settings = {};
      result.rows.forEach(r => { settings[r.key] = r.value; });
      return res.json(settings);
    }

    if (resource === 'setting') {
      if (!PUBLIC_SETTINGS.has(key)) {
        if (!req.headers.authorization) throw new AppError(401, 'Authentication required');
        await new Promise((resolve, reject) => {
          authenticate(req, res, (err) => err ? reject(err) : resolve());
        });
      }
      const result = await pool.query('SELECT value FROM site_settings WHERE key = $1', [key]);
      if (!result.rows.length) throw new AppError(404, 'Setting not found');
      return res.json({ key, value: result.rows[0].value });
    }

    if (resource === 'subscribers') {
      if (!req.headers.authorization) throw new AppError(401, 'Authentication required');
      await new Promise((resolve, reject) => {
        authenticate(req, res, (err) => err ? reject(err) : resolve());
      });
      if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
      const result = await pool.query('SELECT * FROM subscribers ORDER BY created_date DESC LIMIT 1000');
      return res.json(result.rows);
    }

    if (resource === 'messages') {
      if (!req.headers.authorization) throw new AppError(401, 'Authentication required');
      await new Promise((resolve, reject) => {
        authenticate(req, res, (err) => err ? reject(err) : resolve());
      });
      if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
      const result = await pool.query('SELECT * FROM messages ORDER BY created_date DESC LIMIT 100');
      return res.json(result.rows);
    }

    throw new AppError(404, `Unknown resource: ${resource}`);
  } catch (err) {
    next(err);
  }
});

// POST /api/admin
// { resource: 'setting', action: 'update', key, value }
// { resource: 'subscriber', action: 'subscribe'|'delete'|'bulk-delete', ... }
// { resource: 'message', action: 'send'|'mark-read'|'delete'|'bulk-delete', ... }
// { resource: 'upload', action: 'signature', folder }
router.post('/', async (req, res, next) => {
  try {
    const { resource } = req.body;

    // Upload signature - no auth required (signature is used for direct Cloudinary upload)
    if (resource === 'upload') {
      const { action, folder } = req.body;
      if (action === 'signature') {
        try {
          const sig = createUploadSignature({ folder: folder || 'bridge-jobs' });
          return res.json(sig);
        } catch (err) {
          logger.error({ err: err.message }, 'Upload signature failed');
          return res.status(500).json({ error: 'Upload is not configured. Ask the admin to add Cloudinary keys.' });
        }
      }
      throw new AppError(404, `Unknown upload action: ${action}`);
    }

    // All other resources require authentication
    if (!req.headers.authorization) throw new AppError(401, 'Authentication required');
    await new Promise((resolve, reject) => {
      authenticate(req, res, (err) => err ? reject(err) : resolve());
    });

    if (resource === 'setting') {
      if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
      const { action, key, value } = req.body;
      if (action === 'update') {
        if (!key) throw new AppError(400, 'key is required');
        if (value === undefined) throw new AppError(400, 'Value is required');
        await pool.query(
          'INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()',
          [key, JSON.stringify(value)]
        );
        logger.info({ key }, 'Setting updated');
        return res.json({ success: true });
      }
    }

    if (resource === 'subscriber') {
      const { action } = req.body;

      if (action === 'subscribe') {
        const { email, source_page, referrer } = req.body;
        if (!email) throw new AppError(400, 'Email is required');

        const ip = req.headers?.['x-forwarded-for'] || req.headers?.['x-real-ip'] || '';
        const ua = req.headers?.['user-agent'] || '';

        const existing = await pool.query('SELECT id FROM subscribers WHERE email = $1', [email]);
        if (existing.rows.length) {
          await pool.query(
            `UPDATE subscribers SET is_active = true, source_page = COALESCE(NULLIF($1,''), source_page),
             referrer = COALESCE(NULLIF($2,''), referrer), ip_address = COALESCE(NULLIF($3,''), ip_address),
             user_agent = COALESCE(NULLIF($4,''), user_agent)
             WHERE email = $5`,
            [source_page || '', referrer || '', ip, ua, email]
          );
          return res.json({ success: true, message: 'Already subscribed' });
        }

        await pool.query(
          `INSERT INTO subscribers (email, source_page, referrer, ip_address, user_agent)
           VALUES ($1, $2, $3, $4, $5)`,
          [email, source_page || '', referrer || '', ip, ua]
        );
        logger.info({ subscriberEmail: email, source: source_page }, 'New subscriber');
        return res.status(201).json({ success: true });
      }

      if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');

      if (action === 'delete') {
        const result = await pool.query('DELETE FROM subscribers WHERE id = $1', [req.body.id]);
        if (!result.rowCount) throw new AppError(404, 'Subscriber not found');
        logger.info({ subscriberId: req.body.id }, 'Subscriber deleted');
        return res.json({ success: true });
      }

      if (action === 'bulk-delete') {
        const { ids } = req.body;
        if (!Array.isArray(ids) || !ids.length) throw new AppError(400, 'ids array is required');
        const result = await pool.query('DELETE FROM subscribers WHERE id = ANY($1::uuid[])', [ids]);
        logger.info({ count: result.rowCount }, 'Bulk subscribers deleted');
        return res.json({ success: true, deleted: result.rowCount });
      }
    }

    if (resource === 'message') {
      const { action } = req.body;

      if (action === 'send') {
        const { name, email, subject, message } = req.body;
        if (!name || !email || !subject || !message) throw new AppError(400, 'name, email, subject, and message are required');
        const result = await pool.query(
          'INSERT INTO messages (name, email, subject, message) VALUES ($1,$2,$3,$4) RETURNING id',
          [name, email, subject, message]
        );
        logger.info({ messageId: result.rows[0].id }, 'Message received');
        return res.status(201).json({ id: result.rows[0].id, success: true });
      }

      if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');

      if (action === 'mark-read') {
        const result = await pool.query('UPDATE messages SET is_read = true WHERE id = $1', [req.body.id]);
        if (!result.rowCount) throw new AppError(404, 'Message not found');
        return res.json({ success: true });
      }

      if (action === 'delete') {
        const result = await pool.query('DELETE FROM messages WHERE id = $1', [req.body.id]);
        if (!result.rowCount) throw new AppError(404, 'Message not found');
        logger.info({ messageId: req.body.id }, 'Message deleted');
        return res.json({ success: true });
      }

      if (action === 'bulk-delete') {
        const { ids } = req.body;
        if (!Array.isArray(ids) || !ids.length) throw new AppError(400, 'ids array is required');
        const result = await pool.query('DELETE FROM messages WHERE id = ANY($1::uuid[])', [ids]);
        logger.info({ count: result.rowCount }, 'Bulk messages deleted');
        return res.json({ success: true, deleted: result.rowCount });
      }
    }

    throw new AppError(404, `Unknown resource: ${resource}`);
  } catch (err) {
    next(err);
  }
});

export default router;
