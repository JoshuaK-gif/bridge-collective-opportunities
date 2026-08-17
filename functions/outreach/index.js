/**
 * /v1/outreach — newsletter + reminders.
 *
 * GET  /v1/outreach?resource=newsletter&action=status   (admin)
 *
 * POST /v1/outreach  { resource: 'reminder', action: 'create', email, opportunityId, opportunityTitle, deadline }
 * POST /v1/outreach  { resource: 'reminder', action: 'process' }              (x-cron-secret)
 * POST /v1/outreach  { resource: 'newsletter', action: 'send'|'test', ... }   (admin)
 */
import { z } from 'zod';
import { query } from '../_shared/db.js';
import logger from '../_shared/logger.js';
import { requireAdmin } from '../_shared/auth.js';
import { AppError, handle } from '../_shared/errors.js';
import { sendEmail, sendTestEmail } from '../_shared/email.js';
import { sendNewsletter } from '../_shared/newsletter.js';
import { createReminder, processReminders } from '../_shared/reminders.js';

const reminderSchema = z.object({
  email: z.string().email('Invalid email'),
  opportunityId: z.string().min(1, 'Opportunity ID is required'),
  opportunityTitle: z.string().min(1, 'Title is required').max(500),
  deadline: z.string().min(1, 'Deadline is required').max(50),
});

export default handle(async (req, res) => {
  const body = req.body || {};
  const resource = body.resource;
  const action = body.action;

  if (req.method === 'GET' && resource === 'newsletter' && action === 'status') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const result = await query("SELECT value FROM site_settings WHERE key = 'last_newsletter_sent'");
    return res.json(result.rows.length ? result.rows[0].value : null);
  }

  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }

  if (resource === 'reminder' && action === 'create') {
    const parsed = reminderSchema.safeParse(body);
    if (!parsed.success) {
      return res.status(400).json({ error: parsed.error.errors[0].message });
    }
    await createReminder(parsed.data);
    return res.json({ success: true });
  }

  if (resource === 'reminder' && action === 'process') {
    const secret = process.env.CRON_SECRET || process.env.NHOST_WEBHOOK_SECRET;
    if (!secret || req.headers?.['x-cron-secret'] !== secret) {
      return res.status(403).json({ error: 'Forbidden' });
    }
    const result = await processReminders();
    return res.json(result);
  }

  if (resource === 'newsletter' && action === 'send') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const offset = parseInt(body.offset, 10) || 0;
    const result = await sendNewsletter({ batchSize: 50, offset });
    return res.json(result);
  }

  if (resource === 'newsletter' && action === 'test') {
    const admin = await requireAdmin(req, res);
    if (!admin) return;
    const { to, config } = body;
    if (!to) throw new AppError(400, 'Recipient email is required');
    if (!config) throw new AppError(400, 'SMTP config is required');
    const result = await sendTestEmail(config, to);
    return res.json(result);
  }

  throw new AppError(404, `Unknown resource/action: ${resource}/${action}`);
});
