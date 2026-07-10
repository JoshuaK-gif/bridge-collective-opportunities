import 'dotenv/config';
import cron from 'node-cron';
import logger from './lib/logger.js';
import { validateEnv } from './lib/env.js';
import pool from './lib/db.js';
import { runMigrations } from './lib/migrate.js';
import { seed } from './data.js';
import { autoPublish } from './scripts/auto-publish.js';
import { sendNewsletter } from './scripts/send-newsletter.js';

async function startServer() {
  const { createApp } = await import('./server.js');
  const { httpServer } = createApp();
  const PORT = process.env.PORT || 3000;

  cron.schedule('*/2 * * * *', async () => {
    logger.info('Cron: running auto-publish check');
    try {
      await autoPublish();
    } catch (err) {
      logger.error({ err }, 'Cron auto-publish failed');
    }
  });
  logger.info('Auto-publish cron scheduled (every 2 min)');

  // Daily newsletter at 8:00 AM
  cron.schedule('0 8 * * *', async () => {
    logger.info('Cron: running daily newsletter');
    try {
      await sendNewsletter();
    } catch (err) {
      logger.error({ err }, 'Cron newsletter failed');
    }
  });
  logger.info('Daily newsletter cron scheduled (8:00 AM)');

  // Deadline reminder emails every hour
  cron.schedule('0 * * * *', async () => {
    logger.info('Cron: processing deadline reminders');
    try {
      const { default: pool } = await import('./lib/db.js');
      const existing = await pool.query("SELECT value FROM site_settings WHERE key = 'reminders'");
      if (existing.rows.length) {
        const reminders = existing.rows[0].value;
        if (Array.isArray(reminders) && reminders.length > 0) {
          const { getSmtpConfig, sendEmail } = await import('./lib/email.js');
          const config = await getSmtpConfig();
          if (config?.host) {
            const now = new Date();
            let updated = [...reminders];
            let processed = 0;
            for (let i = 0; i < updated.length; i++) {
              const r = updated[i];
              if (r.sent) continue;
              const deadlineDate = new Date(r.deadline);
              const diffMs = deadlineDate.getTime() - now.getTime();
              const diffDays = diffMs / (1000 * 60 * 60 * 24);
              if (diffDays <= 2 && diffDays >= 0) {
                const result = await sendEmail({
                  to: r.email,
                  subject: `Reminder: "${r.opportunityTitle}" deadline is approaching!`,
                  html: `<div style="font-family:sans-serif;padding:24px;max-width:480px;margin:0 auto;"><h2>Deadline Reminder</h2><p>The opportunity "<strong>${r.opportunityTitle}</strong>" closes <strong>${r.deadline}</strong>!</p><a href="https://bridgejobs.ug/opportunities/${r.opportunityId}" style="display:inline-block;background:#667eea;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">View Opportunity</a></div>`,
                });
                if (result.success) {
                  updated[i] = { ...r, sent: true, sentAt: now.toISOString() };
                  processed++;
                }
              }
              if (diffDays < -7) { updated.splice(i, 1); i--; }
            }
            await pool.query("UPDATE site_settings SET value = $1 WHERE key = 'reminders'", [JSON.stringify(updated)]);
            logger.info({ processed }, 'Reminder emails processed');
          }
        }
      }
    } catch (err) {
      logger.error({ err }, 'Cron reminders failed');
    }
  });
  logger.info('Deadline reminder cron scheduled (every hour)');

  function shutdown(signal) {
    logger.info({ signal }, 'Shutting down');
    httpServer.close(async () => {
      await pool.end().catch(() => {});
      process.exit(0);
    });
    setTimeout(() => {
      logger.error('Forced shutdown');
      process.exit(1);
    }, 10000);
  }

  process.on('SIGTERM', () => shutdown('SIGTERM'));
  process.on('SIGINT', () => shutdown('SIGINT'));

  httpServer.listen(PORT, () => {
    logger.info(`Server started on :${PORT}`);
  });
}

validateEnv();
await runMigrations();
await seed();
logger.info('Database ready');
await startServer();
