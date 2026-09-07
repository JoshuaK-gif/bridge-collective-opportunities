import 'dotenv/config';
import dns from 'node:dns';
dns.setDefaultResultOrder('ipv4first');
import cron from 'node-cron';
import logger from './lib/logger.js';
import { validateEnv } from './lib/env.js';
import pool from './lib/db.js';
import { runMigrations } from './lib/migrate.js';
import { seed } from './data.js';

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
