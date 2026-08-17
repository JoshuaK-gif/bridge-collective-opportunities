/**
 * POST /v1/cron/:job — scheduled jobs (guarded by x-cron-secret).
 *
 * Jobs:
 *   scheduled-publish  — activate drafts whose publish_at <= now   (every minute in the old server)
 *   expired-cleanup    — delete active opportunities past deadline (daily)
 *   newsletter         — send daily newsletter (batched)           (daily 20:00)
 *   reminders          — deadline reminder emails                  (hourly)
 *   auto-publish       — DISABLED: requires AI (rewrite/image/enrich)
 *
 * Triggered by .github/workflows/cron.yml or Nhost cron triggers.
 */
import { query } from '../_shared/db.js';
import { handle } from '../_shared/errors.js';
import logger from '../_shared/logger.js';
import { sendNewsletter } from '../_shared/newsletter.js';
import { processReminders } from '../_shared/reminders.js';

function authorized(req, res) {
  const secret = process.env.CRON_SECRET || process.env.NHOST_WEBHOOK_SECRET;
  if (!secret) {
    res.status(500).json({ error: 'CRON_SECRET not configured' });
    return false;
  }
  if (req.headers?.['x-cron-secret'] !== secret) {
    res.status(401).json({ error: 'Unauthorized' });
    return false;
  }
  return true;
}

export default handle(async (req, res) => {
  if (req.method !== 'POST') {
    return res.status(405).json({ error: 'Method not allowed' });
  }
  if (!authorized(req, res)) return;

  const job = req.params?.job || req.query.job;
  if (!job) return res.status(400).json({ error: 'job is required' });

  switch (job) {
    case 'scheduled-publish': {
      const result = await query(
        "UPDATE opportunities SET status = 'active', updated_date = now() WHERE status = 'draft' AND publish_at IS NOT NULL AND publish_at <= now()"
      );
      logger.info({ published: result.rowCount }, 'scheduled-publish done');
      return res.json({ job, published: result.rowCount });
    }
    case 'expired-cleanup': {
      const result = await query(
        "DELETE FROM opportunities WHERE status = 'active' AND deadline ~ '^\\d{4}-\\d{2}-\\d{2}$' AND TO_DATE(deadline, 'YYYY-MM-DD') < CURRENT_DATE"
      );
      logger.info({ deleted: result.rowCount }, 'expired-cleanup done');
      return res.json({ job, deleted: result.rowCount });
    }
    case 'newsletter': {
      // Batched so each invocation stays under the 10s function timeout.
      const offset = parseInt(req.query.offset, 10) || 0;
      const result = await sendNewsletter({ batchSize: 50, offset });
      return res.json({ job, ...result });
    }
    case 'reminders': {
      const result = await processReminders();
      return res.json({ job, ...result });
    }
    case 'auto-publish':
      return res.status(501).json({
        job,
        error: 'auto-publish requires AI (rewrite + image generation + enrichment) and is disabled on the Nhost free-tier backend. See MIGRATION.md.',
      });
    default:
      return res.status(404).json({ error: `Unknown job: ${job}` });
  }
});
