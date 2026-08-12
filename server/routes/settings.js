import { Router } from 'express';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

const PUBLIC_SETTINGS = new Set(['site_name', 'site_description', 'site_logo', 'contact_email', 'cv_tips', 'ga_measurement_id']);

router.get('/:key', async (req, res, next) => {
  try {
    if (!PUBLIC_SETTINGS.has(req.params.key)) {
      if (!req.headers.authorization) throw new AppError(401, 'Authentication required');
      await new Promise((resolve, reject) => {
        authenticate(req, res, (err) => err ? reject(err) : resolve());
      });
    }
    const result = await pool.query('SELECT value FROM site_settings WHERE key = $1', [req.params.key]);
    if (!result.rows.length) throw new AppError(404, 'Setting not found');
    res.json({ key: req.params.key, value: result.rows[0].value });
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const result = await pool.query('SELECT key, value FROM site_settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.json(settings);
  } catch (err) {
    next(err);
  }
});

router.put('/:key', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { value } = req.body;
    if (value === undefined) throw new AppError(400, 'Value is required');
    await pool.query(
      'INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()',
      [req.params.key, JSON.stringify(value)]
    );
    logger.info({ key: req.params.key }, 'Setting updated');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
