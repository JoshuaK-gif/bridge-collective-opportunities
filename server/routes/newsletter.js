import { Router } from 'express';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';
import { AppError } from '../lib/errors.js';
import { sendTestEmail } from '../lib/email.js';
import { sendNewsletter } from '../scripts/send-newsletter.js';

const router = Router();

// POST /api/newsletter/send — manually trigger newsletter (admin only)
router.post('/send', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const result = await sendNewsletter();
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// POST /api/newsletter/test — send test email (admin only)
router.post('/test', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { to, config } = req.body;
    if (!to) throw new AppError(400, 'Recipient email is required');
    if (!config) throw new AppError(400, 'SMTP config is required');
    const result = await sendTestEmail(config, to);
    res.json(result);
  } catch (err) {
    next(err);
  }
});

// GET /api/newsletter/status — get last newsletter status (admin only)
router.get('/status', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const result = await pool.query("SELECT value FROM site_settings WHERE key = 'last_newsletter_sent'");
    res.json(result.rows.length ? result.rows[0].value : null);
  } catch (err) {
    next(err);
  }
});

export default router;
