import { Router } from 'express';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { sendEmail, getSmtpConfig } from '../lib/email.js';

const router = Router();

// POST /api/reminders - Schedule a reminder for an opportunity
router.post('/', async (req, res, next) => {
  try {
    const { email, opportunityId, opportunityTitle, deadline } = req.body;
    if (!email || !opportunityId || !opportunityTitle || !deadline) {
      return res.status(400).json({ error: 'Missing required fields' });
    }

    // Store reminder in site_settings for simplicity
    const existing = await pool.query("SELECT value FROM site_settings WHERE key = 'reminders'");
    let reminders = [];
    if (existing.rows.length) {
      reminders = existing.rows[0].value;
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

    // Keep only last 100
    if (reminders.length > 100) reminders = reminders.slice(-100);

    await pool.query(
      "UPDATE site_settings SET value = $1, updated_at = now() WHERE key = 'reminders'",
      [JSON.stringify(reminders)]
    );

    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/reminders/process - Process pending reminders (called by cron)
router.post('/process', async (req, res, next) => {
  try {
    const smtpConfig = await getSmtpConfig();
    if (!smtpConfig || !smtpConfig.host) {
      return res.json({ processed: 0, skipped: true });
    }

    const existing = await pool.query("SELECT value FROM site_settings WHERE key = 'reminders'");
    if (!existing.rows.length) return res.json({ processed: 0 });

    const reminders = existing.rows[0].value;
    if (!reminders || !Array.isArray(reminders) || reminders.length === 0) {
      return res.json({ processed: 0 });
    }

    const now = new Date();
    let processed = 0;
    let updatedReminders = [...reminders];

    for (let i = 0; i < updatedReminders.length; i++) {
      const r = updatedReminders[i];
      if (r.sent) continue;

      const deadlineDate = new Date(r.deadline);
      const diffMs = deadlineDate.getTime() - now.getTime();
      const diffDays = diffMs / (1000 * 60 * 60 * 24);

      // Send reminder when 48h before deadline
      if (diffDays <= 2 && diffDays >= 0) {
        const result = await sendEmail({
          to: r.email,
          subject: `Reminder: "${r.opportunityTitle}" deadline is approaching!`,
          html: `
            <!DOCTYPE html>
            <html>
            <head><meta charset="utf-8"></head>
            <body style="font-family:-apple-system,sans-serif;background:#f4f4f6;padding:24px;">
              <div style="max-width:480px;margin:0 auto;background:#fff;border-radius:12px;padding:24px;">
                <h2 style="margin:0 0 8px;font-size:18px;">Deadline Reminder</h2>
                <p style="color:#555;margin:0 0 16px;font-size:14px;">
                  The opportunity <strong>"${r.opportunityTitle}"</strong> is closing soon!
                </p>
                <p style="color:#555;margin:0 0 16px;font-size:14px;">
                  Deadline: <strong>${r.deadline}</strong><br/>
                  Time remaining: <strong>${Math.ceil(diffDays * 24)} hours</strong>
                </p>
                <a href="https://bridgejobs.ug/opportunities/${r.opportunityId}"
                   style="display:inline-block;background:#667eea;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;font-size:14px;">
                  View Opportunity
                </a>
                <p style="color:#999;font-size:12px;margin-top:24px;">
                  You set this reminder on Bridge Collective Opportunities.
                </p>
              </div>
            </body>
            </html>
          `,
        });

        if (result.success) {
          updatedReminders[i] = { ...r, sent: true, sentAt: now.toISOString() };
          processed++;
        }
      }

      // Clean up reminders for past deadlines
      if (diffDays < -7) {
        updatedReminders.splice(i, 1);
        i--;
      }
    }

    await pool.query(
      "UPDATE site_settings SET value = $1, updated_at = now() WHERE key = 'reminders'",
      [JSON.stringify(updatedReminders)]
    );

    logger.info({ processed }, 'Reminder emails processed');
    res.json({ processed });
  } catch (err) {
    next(err);
  }
});

export default router;
