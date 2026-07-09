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
