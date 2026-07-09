import { Router } from 'express';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';
import { AppError } from '../lib/errors.js';
import { validate, subscriberSchema } from '../lib/validate.js';

const router = Router();

async function geoLookup(ip) {
  if (!ip || ip === '127.0.0.1' || ip === '::1' || ip.startsWith('192.168.') || ip.startsWith('10.') || ip.startsWith('172.')) {
    return { city: '', country: '' };
  }
  try {
    const resp = await fetch(`http://ip-api.com/json/${ip}?fields=city,country`, { signal: AbortSignal.timeout(3000) });
    if (resp.ok) {
      const data = await resp.json();
      return { city: data.city || '', country: data.country || '' };
    }
  } catch {}
  return { city: '', country: '' };
}

router.post('/', validate(subscriberSchema), async (req, res, next) => {
  try {
    const { email, source_page, referrer } = req.body;

    const ip = req.ip || req.headers['x-forwarded-for'] || '';
    const ua = req.headers['user-agent'] || '';
    const geo = await geoLookup(ip);

    const existing = await pool.query('SELECT id FROM subscribers WHERE email = $1', [email]);
    if (existing.rows.length) {
      await pool.query(
        `UPDATE subscribers SET is_active = true, source_page = COALESCE(NULLIF($1,''), source_page),
         referrer = COALESCE(NULLIF($2,''), referrer), ip_address = COALESCE(NULLIF($3,''), ip_address),
         city = COALESCE(NULLIF($4,''), city), country = COALESCE(NULLIF($5,''), country),
         user_agent = COALESCE(NULLIF($6,''), user_agent)
         WHERE email = $7`,
        [source_page || '', referrer || '', ip, geo.city, geo.country, ua, email]
      );
      return res.json({ success: true, message: 'Already subscribed' });
    }

    await pool.query(
      `INSERT INTO subscribers (email, source_page, referrer, ip_address, city, country, user_agent)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [email, source_page || '', referrer || '', ip, geo.city, geo.country, ua]
    );
    logger.info({ subscriberEmail: email, source: source_page, country: geo.country }, 'New subscriber');
    res.status(201).json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const result = await pool.query('SELECT * FROM subscribers ORDER BY created_date DESC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.delete('/bulk', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) throw new AppError(400, 'ids array is required');
    const result = await pool.query('DELETE FROM subscribers WHERE id = ANY($1::uuid[])', [ids]);
    logger.info({ count: result.rowCount }, 'Bulk subscribers deleted');
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const result = await pool.query('DELETE FROM subscribers WHERE id = $1', [req.params.id]);
    if (!result.rowCount) throw new AppError(404, 'Subscriber not found');
    logger.info({ subscriberId: req.params.id }, 'Subscriber deleted');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
