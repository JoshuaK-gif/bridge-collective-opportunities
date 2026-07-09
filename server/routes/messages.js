import { Router } from 'express';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';
import { AppError } from '../lib/errors.js';
import { sendEmail } from '../lib/email.js';
import { validate, messageSchema } from '../lib/validate.js';

const router = Router();

router.post('/', validate(messageSchema), async (req, res, next) => {
  try {
    const { name, email, subject, message } = req.body;
    const result = await pool.query(
      'INSERT INTO messages (name, email, subject, message) VALUES ($1,$2,$3,$4) RETURNING id',
      [name, email, subject, message]
    );
    logger.info({ messageId: result.rows[0].id }, 'Message received');

    // Notify admin via email (fire-and-forget)
    const adminEmail = await pool.query("SELECT email FROM users WHERE role = 'admin' LIMIT 1");
    if (adminEmail.rows.length) {
      sendEmail({
        to: adminEmail.rows[0].email,
        subject: `[Bridge Jobs] ${subject}`,
        html: `
          <h2>New Contact Form Submission</h2>
          <table style="border-collapse:collapse;width:100%;max-width:500px;">
            <tr><td style="padding:8px;font-weight:600;color:#555;border-bottom:1px solid #eee;">Name</td><td style="padding:8px;border-bottom:1px solid #eee;">${name}</td></tr>
            <tr><td style="padding:8px;font-weight:600;color:#555;border-bottom:1px solid #eee;">Email</td><td style="padding:8px;border-bottom:1px solid #eee;"><a href="mailto:${email}">${email}</a></td></tr>
            <tr><td style="padding:8px;font-weight:600;color:#555;border-bottom:1px solid #eee;">Subject</td><td style="padding:8px;border-bottom:1px solid #eee;">${subject}</td></tr>
          </table>
          <h3 style="margin-top:16px;">Message</h3>
          <p style="background:#f5f5f5;padding:12px;border-radius:6px;white-space:pre-wrap;">${message}</p>
          <hr style="border:none;border-top:1px solid #eee;margin:16px 0;" />
          <p style="font-size:12px;color:#999;">View in admin: <a href="https://bridgejobs.ug/admin-bridgejobs/messages">bridgejobs.ug/admin-bridgejobs/messages</a></p>
        `,
      }).catch(err => logger.warn({ err: err.message }, 'Failed to notify admin of message'));
    }

    res.status(201).json({ id: result.rows[0].id, success: true });
  } catch (err) {
    next(err);
  }
});

router.get('/', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const result = await pool.query('SELECT * FROM messages ORDER BY created_date DESC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.put('/:id/read', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const result = await pool.query('UPDATE messages SET is_read = true WHERE id = $1', [req.params.id]);
    if (!result.rowCount) throw new AppError(404, 'Message not found');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/bulk', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) throw new AppError(400, 'ids array is required');
    const result = await pool.query('DELETE FROM messages WHERE id = ANY($1::uuid[])', [ids]);
    logger.info({ count: result.rowCount }, 'Bulk messages deleted');
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const result = await pool.query('DELETE FROM messages WHERE id = $1', [req.params.id]);
    if (!result.rowCount) throw new AppError(404, 'Message not found');
    logger.info({ messageId: req.params.id }, 'Message deleted');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
