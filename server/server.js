import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import path from 'path';
import pool from './lib/db.js';
import logger from './lib/logger.js';
import { errorHandler } from './lib/errors.js';
import { correlationId } from './lib/correlation.js';

import authRoutes from './routes/auth.js';
import opportunityRoutes from './routes/opportunities.js';
import uploadRoutes from './routes/upload.js';
import messageRoutes from './routes/messages.js';
import settingRoutes from './routes/settings.js';
import subscriberRoutes from './routes/subscribers.js';
import scraperRoutes from './routes/scraper.js';
import categoryRoutes from './routes/categories.js';
import listRoutes from './routes/lists.js';
import newsletterRoutes from './routes/newsletter.js';
import sitemapRoutes from './routes/sitemap.js';
import feedRoutes from './routes/feed.js';
import relatedRoutes from './routes/related.js';
import newsRoutes from './routes/news.js';

let Sentry = null;
if (process.env.SENTRY_DSN) {
  Sentry = await import('@sentry/node');
  Sentry.default.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    tracesSampleRate: 0.1,
  });
  globalThis.__SENTRY__ = Sentry.default;
}

export function createApp() {
  const app = express();
  const httpServer = createServer(app);

  if (Sentry) {
    app.use(Sentry.default.Handlers.requestHandler());
  }

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }));
  app.use(compression());
  app.use(cors({ origin: process.env.CORS_ORIGIN, credentials: true }));
  app.use(express.json({ limit: '10mb' }));
  app.use(correlationId);

  app.use((req, res, next) => {
    res.setTimeout(30000, () => {
      logger.warn({ path: req.path, method: req.method, correlationId: req.correlationId }, 'Request timeout');
      res.status(503).json({ error: 'Request timeout' });
    });
    next();
  });

  app.use(rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 1000,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Too many requests' },
  }));

  app.use((req, res, next) => {
    const start = Date.now();
    res.on('finish', () => {
      const duration = Date.now() - start;
      const level = res.statusCode >= 500 ? 'error' : res.statusCode >= 400 ? 'warn' : 'info';
      logger[level]({ method: req.method, path: req.path, status: res.statusCode, duration, correlationId: req.correlationId }, 'request');
    });
    next();
  });

  app.use('/api/auth', authRoutes);
  app.use('/api/opportunities', opportunityRoutes);
  app.use('/api/upload', uploadRoutes);
  app.use('/api/messages', messageRoutes);
  app.use('/api/settings', settingRoutes);
  app.use('/api/subscribers', subscriberRoutes);
  app.use('/api/categories', categoryRoutes);
  app.use('/api/lists', listRoutes);
  app.use('/api/scraper', scraperRoutes);
  app.use('/api/newsletter', newsletterRoutes);
  app.use('/api/sitemap.xml', sitemapRoutes);
  app.use('/api/rss.xml', feedRoutes);
  app.use('/api/related', relatedRoutes);
  app.use('/api/news', newsRoutes);

  app.get('/api/health', async (req, res) => {
    const checks = { status: 'ok' };
    try {
      await pool.query('SELECT 1');
      checks.db = 'connected';
    } catch {
      checks.db = 'disconnected';
      checks.status = 'degraded';
    }
    res.status(checks.status === 'ok' ? 200 : 503).json(checks);
  });

  // Public unsubscribe endpoint
  app.get('/api/unsubscribe', async (req, res) => {
    try {
      const { email, id } = req.query;
      if (!email) return res.status(400).json({ error: 'Email is required' });
      await pool.query(
        "UPDATE subscribers SET unsubscribed_at = now(), is_active = false WHERE email = $1 AND ($2::uuid IS NULL OR id = $2::uuid)",
        [email, id || null]
      );
      res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f4f4f6;}.card{background:#fff;padding:40px;border-radius:12px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.08);max-width:400px;}h1{font-size:20px;color:#333;margin:0 0 8px;}p{font-size:14px;color:#666;margin:0;}</style></head><body><div class="card"><h1>Unsubscribed</h1><p>You have been unsubscribed from Bridge Collective Opportunities emails. You will no longer receive daily updates.</p></div></body></html>`);
    } catch (err) {
      res.status(500).send('Something went wrong');
    }
  });

  const distPath = path.resolve(process.cwd(), '..', 'dist');
  app.use(express.static(distPath));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'));
  });

  if (Sentry) {
    app.use(Sentry.default.Handlers.errorHandler());
  }

  app.use(errorHandler);

  return { app, httpServer };
}
