import 'dotenv/config';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import cron from 'node-cron';
import logger from './lib/logger.js';
import { validateEnv } from './lib/env.js';
import pool from './lib/db.js';
import { runMigrations } from './lib/migrate.js';
import { seed } from './data.js';
import { sendNewsletter } from './scripts/send-newsletter.js';

async function startServer() {
  const { createApp } = await import('./server.js');
  const { httpServer } = createApp();
  const PORT = process.env.PORT || 3000;

  // Auto-delete past-deadline opportunities — runs daily at midnight
  cron.schedule('0 0 * * *', async () => {
    logger.info('Cron: running auto-delete expired');
    try {
      const result = await pool.query(
        "DELETE FROM opportunities WHERE status = 'active' AND deadline ~ '^\\d{4}-\\d{2}-\\d{2}$' AND TO_DATE(deadline, 'YYYY-MM-DD') < CURRENT_DATE"
      );
      if (result.rowCount > 0) {
        logger.info({ deleted: result.rowCount }, 'Expired opportunities auto-deleted');
      }
    } catch (err) {
      logger.error({ err }, 'Cron auto-delete failed');
    }
  });
  logger.info('Auto-delete expired cron scheduled (daily at midnight)');

  // Scheduled publishing — runs every minute to activate opportunities with publish_at <= now
  cron.schedule('* * * * *', async () => {
    try {
      const result = await pool.query(
        "UPDATE opportunities SET status = 'active', updated_date = now() WHERE status = 'draft' AND publish_at IS NOT NULL AND publish_at <= now()"
      );
      if (result.rowCount > 0) {
        logger.info({ published: result.rowCount }, 'Scheduled opportunities activated');
      }
    } catch (err) {
      logger.error({ err }, 'Cron scheduled publishing failed');
    }
  });
  logger.info('Scheduled publishing cron (every minute)');

  // Daily newsletter at 8:00 PM
  cron.schedule('0 20 * * *', async () => {
    logger.info('Cron: running daily newsletter');
    try {
      await sendNewsletter();
    } catch (err) {
      logger.error({ err }, 'Cron newsletter failed');
    }
  });
  logger.info('Daily newsletter cron scheduled (8:00 PM)');

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
              const deadlineDate = new Date(r.deadline + 'T00:00:00');
              const diffMs = deadlineDate.getTime() - now.getTime();
              const diffDays = diffMs / (1000 * 60 * 60 * 24);
              if (diffDays < -7) { updated.splice(i, 1); i--; continue; }
              if (r.sent) continue;
              if (diffDays <= 2 && diffDays >= 0) {
                const result = await sendEmail({
                  to: r.email,
                  subject: `Reminder: "${r.opportunityTitle}" deadline is approaching!`,
                  html: `<div style="font-family:sans-serif;padding:24px;max-width:480px;margin:0 auto;"><h2>Deadline Reminder</h2><p>The opportunity "<strong>${r.opportunityTitle}</strong>" closes <strong>${r.deadline}</strong>!</p><a href="https://bridgecollectiveopport.org/opportunities/${r.opportunityId}" style="display:inline-block;background:#667eea;color:#fff;padding:10px 20px;border-radius:8px;text-decoration:none;">View Opportunity</a></div>`,
                });
                if (result.success) {
                  updated[i] = { ...r, sent: true, sentAt: now.toISOString() };
                  processed++;
                }
              }
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
// Ensure users table exists and has an admin user (migrations may have silently failed)
try {
  const tableCheck = await pool.query("SELECT EXISTS (SELECT FROM information_schema.tables WHERE table_name = 'users')");
  if (!tableCheck.rows[0]?.exists) {
    logger.info('Users table missing — creating it now');
    await pool.query(`CREATE TABLE IF NOT EXISTS users (
      id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
      email TEXT UNIQUE NOT NULL,
      password TEXT NOT NULL,
      full_name TEXT NOT NULL,
      role TEXT NOT NULL DEFAULT 'user' CHECK (role IN ('user', 'admin')),
      failed_attempts INTEGER DEFAULT 0,
      locked_until TIMESTAMPTZ,
      created_date TIMESTAMPTZ NOT NULL DEFAULT now()
    )`);
    // Re-run seed after creating table
    const { seed } = await import('./data.js');
    await seed();
  }
} catch (e) {
  logger.warn({ err: e.message }, 'Could not verify users table');
}
logger.info('Database ready');
await startServer();
