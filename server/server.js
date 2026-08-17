import express from 'express';
import cors from 'cors';
import helmet from 'helmet';
import compression from 'compression';
import rateLimit from 'express-rate-limit';
import { createServer } from 'http';
import path from 'path';
import { fileURLToPath } from 'url';
import pool from './lib/db.js';
import logger from './lib/logger.js';
import { errorHandler } from './lib/errors.js';
import { correlationId } from './lib/correlation.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
import reminderRoutes from './routes/reminders.js';
import resumeRoutes from './routes/resume.js';
import resumesRoutes from './routes/resumes.js';
import aiRoutes from './routes/ai.js';
import grantkitRoutes from './routes/grantkit.js';
import cvPdfRoutes from './routes/cv-pdf.js';
import templateRoutes from './routes/templates.js';

let Sentry = null;
if (process.env.SENTRY_DSN) {
  try {
    Sentry = await import('@sentry/node');
    Sentry.default.init({
      dsn: process.env.SENTRY_DSN,
      environment: process.env.NODE_ENV || 'development',
      tracesSampleRate: 0.1,
    });
    globalThis.__SENTRY__ = Sentry.default;
  } catch (e) {
    logger.warn({ err: e.message }, 'Sentry not available — skipping initialization');
  }
}

export function createApp() {
  const app = express();
  app.set('trust proxy', 1);
  const httpServer = createServer(app);

  if (Sentry) {
    app.use(Sentry.default.Handlers.requestHandler());
  }

  app.use(helmet({
    crossOriginResourcePolicy: { policy: 'cross-origin' },
    contentSecurityPolicy: false,
  }));
  app.use(compression());
  const corsOrigins = (process.env.CORS_ORIGIN || '').split(',').map(s => s.trim()).filter(Boolean);
  corsOrigins.push('capacitor://localhost', 'ionic://localhost', 'http://localhost', 'http://localhost:5173', 'http://localhost:3000');
  app.use(cors({
    origin: (origin, cb) => {
      if (!origin || corsOrigins.includes(origin) || origin.startsWith('capacitor://') || origin.startsWith('ionic://')) {
        cb(null, true);
      } else {
        cb(null, corsOrigins[0] || true);
      }
    },
    credentials: true,
  }));
  app.use(express.json({ limit: '10mb' }));
  app.use(correlationId);

  app.use((req, res, next) => {
    let timedOut = false;
    res.setTimeout(30000, () => {
      if (res.headersSent || timedOut) return;
      timedOut = true;
      logger.warn({ path: req.path, method: req.method, correlationId: req.correlationId }, 'Request timeout');
      res.status(503).json({ error: 'Request timeout' });
    });
    const originalJson = res.json.bind(res);
    res.json = function (body) {
      if (timedOut) return;
      timedOut = true;
      return originalJson(body);
    };
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
  app.use('/api/reminders', reminderRoutes);
  app.use('/api/resume', resumeRoutes);
  app.use('/api/resumes', resumesRoutes);
  app.use('/api/ai', aiRoutes);
  app.use('/api/ai/grantkit', grantkitRoutes);
  app.use('/api', cvPdfRoutes);
  app.use('/api/templates', templateRoutes);

  app.get('/robots.txt', (req, res) => {
    res.type('text/plain');
    res.send(`User-agent: *
Allow: /
Disallow: /api/
Disallow: /admin/

Sitemap: https://bridgecollectiveopport.org/api/sitemap.xml
`);
  });

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

  // Handle crawlers: serve prerendered HTML with proper meta tags
  app.get('*', async (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    if (req.path.startsWith('/assets/')) return next();

    const ua = (req.headers['user-agent'] || '').toLowerCase();
    const isCrawler = /googlebot|bingbot|yandexbot|duckduckbot|slurp|baiduspider|facebookexternalhit|twitterbot|whatsapp|linkedinbot|slackbot|discordbot|telegrambot|applebot|semrush/i.test(ua);

    if (isCrawler) {
      const siteUrl = process.env.SITE_URL || 'https://bridgecollectiveopport.org';
      const pathname = req.path;

      const oppMatch = pathname.match(/^\/opportunities\/([a-f0-9-]+)$/i);
      const catMatch = pathname.match(/^\/category\/([a-z-]+)$/i);

      let pageTitle = 'Bridge Collective Opportunities (BCO) — Youth Jobs, Scholarships & Grants';
      let pageDesc = 'Bridge Collective is a leading platform that connects youths to various opportunities — scholarships, grants, jobs, internships & fellowships. Apply free today!';
      let pageImage = siteUrl + '/BCO.png';
      let extraSchema = '';

      if (oppMatch) {
        try {
          const { rows } = await pool.query(
            "SELECT id, title, description, image_url, category, organization, location, deadline, created_at FROM opportunities WHERE id = $1 AND status = 'active'",
            [oppMatch[1]]
          );
          if (rows.length > 0) {
            const opp = rows[0];
            const cleanDesc = (opp.description || '').replace(/<[^>]*>/g, '').substring(0, 300);
            pageTitle = opp.title + ' | Bridge Collective Opportunities';
            pageDesc = cleanDesc || ('Apply for ' + opp.title + ' on Bridge Collective Opportunities.');
            pageImage = opp.image_url ? (opp.image_url.startsWith('http') ? opp.image_url : siteUrl + opp.image_url) : siteUrl + '/BCO.png';
            extraSchema = ',\n    ' + JSON.stringify({
              '@type': 'Product',
              'name': opp.title,
              'description': cleanDesc || opp.title,
              'category': opp.category || 'Opportunity',
              'url': siteUrl + '/opportunities/' + opp.id,
              'image': pageImage
            });
          }
        } catch (e) {
          // fallback to generic
        }
      } else if (catMatch) {
        const cat = catMatch[1];
        const catNames = {
          scholarships: 'Scholarship', grants: 'Grant', jobs: 'Job',
          internships: 'Internship', fellowships: 'Fellowship',
          training: 'Training', volunteer: 'Volunteer'
        };
        const displayName = catNames[cat] || cat;
        pageTitle = displayName + ' Opportunities | Bridge Collective Opportunities';
        pageDesc = 'Browse ' + displayName.toLowerCase() + ' opportunities for youth in Uganda and East Africa. Find ' + displayName.toLowerCase() + ' programs, apply online free.';
      } else if (pathname === '/about') {
        pageTitle = 'About | Bridge Collective Opportunities';
        pageDesc = 'Bridge Collective is a leading platform that connects youths to various opportunities — scholarships, grants, jobs, internships & fellowships.';
      } else if (pathname === '/services') {
        pageTitle = 'Media & Marketing Services | Bridge Collective Opportunities';
        pageDesc = 'Partner with Bridge Collective Opportunities to reach ambitious youth across Africa. Promote your scholarships, jobs and grants to thousands of qualified applicants.';
      } else if (pathname === '/contact') {
        pageTitle = 'Contact | Bridge Collective Opportunities';
        pageDesc = 'Get in touch with the Bridge Collective Opportunities team. We are here to help with your hiring and job search needs.';
      } else if (pathname === '/cv-builder') {
        pageTitle = 'Free CV Builder | Bridge Collective Opportunities';
        pageDesc = 'Create a professional CV online with our free CV builder. Stand out to employers and opportunity providers with a polished resume.';
      } else if (pathname === '/cv-tips') {
        pageTitle = 'CV Writing Tips | Bridge Collective Opportunities';
        pageDesc = 'Learn how to write a standout CV that gets you noticed by employers and opportunity providers. Expert tips and examples.';
      } else if (pathname === '/cv-review') {
        pageTitle = 'AI CV Review | Bridge Collective Opportunities';
        pageDesc = 'Upload your CV and get instant AI-powered feedback. Improve your resume with our free CV review tool.';
      } else if (pathname === '/ai-assistant') {
        pageTitle = 'AI Grant Assistant | Bridge Collective Opportunities';
        pageDesc = 'Get AI-powered application tips, write grants, and polish your applications with our AI assistant.';
      } else if (pathname === '/privacy-policy') {
        pageTitle = 'Privacy Policy | Bridge Collective Opportunities';
        pageDesc = 'Read the Bridge Collective Opportunities privacy policy. Learn how we protect your personal data.';
      } else if (pathname === '/terms-of-service' || pathname === '/terms') {
        pageTitle = 'Terms of Service | Bridge Collective Opportunities';
        pageDesc = 'Read the Bridge Collective Opportunities terms of service and conditions of use.';
      } else if (pathname === '/saved') {
        pageTitle = 'Saved Opportunities | Bridge Collective Opportunities';
        pageDesc = 'View your bookmarked opportunities on Bridge Collective Opportunities.';
      } else if (pathname === '/my-applications') {
        pageTitle = 'My Applications | Bridge Collective Opportunities';
        pageDesc = 'Track your job and opportunity applications on Bridge Collective Opportunities.';
      }

      const html = `<!doctype html>
<html lang="en-US">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <meta name="google-site-verification" content="${process.env.GOOGLE_VERIFICATION_CODE || 'YOUR_GOOGLE_SEARCH_CONSOLE_VERIFICATION_CODE'}" />
  <title>${pageTitle}</title>
  <meta name="description" content="${pageDesc}">
  <meta name="robots" content="index, follow">
  <meta property="og:type" content="website">
  <meta property="og:url" content="${siteUrl}${pathname}">
  <meta property="og:title" content="${pageTitle}">
  <meta property="og:description" content="${pageDesc}">
  <meta property="og:image" content="${pageImage}">
  <meta property="og:image:width" content="1200">
  <meta property="og:image:height" content="630">
  <meta property="og:site_name" content="Bridge Collective Opportunities">
  <meta name="twitter:card" content="summary_large_image">
  <meta name="twitter:title" content="${pageTitle}">
  <meta name="twitter:description" content="${pageDesc}">
  <meta name="twitter:image" content="${pageImage}">
  <meta name="twitter:site" content="@bridgecollectiveug">
  <link rel="canonical" href="${siteUrl}${pathname}">
  <link rel="icon" type="image/png" href="/BCO.png">
  <link rel="manifest" href="/manifest.json">
  <script type="application/ld+json">
  {
    "@context": "https://schema.org",
    "@type": "Organization",
    "name": "Bridge Collective Opportunities",
    "url": "${siteUrl}",
    "logo": "${siteUrl}/BCO.png",
    "description": "Bridge Collective is a leading platform that connects youths to various opportunities.",
    "email": "bridgecollectiveopportunities@gmail.com"
    ${extraSchema}
  }
  </script>
</head>
<body>
  <div id="root"></div>
</body>
</html>`;
      return res.send(html);
    }

    next();
  });

  const distPath = path.resolve(__dirname, '..', 'dist');
  app.use(express.static(distPath, {
    maxAge: '1y',
    immutable: true,
    setHeaders: (res, path) => {
      if (path.endsWith('.html')) {
        // HTML should not be cached for too long
        res.setHeader('Cache-Control', 'public, max-age=0, must-revalidate');
      } else if (path.endsWith('.css') || path.endsWith('.js')) {
        // JS/CSS are hashed — cache forever
        res.setHeader('Cache-Control', 'public, max-age=31536000, immutable');
      } else if (path.match(/\.(png|jpg|jpeg|gif|ico|svg|webp)$/)) {
        // Images — cache for a week
        res.setHeader('Cache-Control', 'public, max-age=604800, must-revalidate');
      } else if (path.endsWith('.json') || path.endsWith('.xml')) {
        // JSON/XML — short cache
        res.setHeader('Cache-Control', 'public, max-age=3600');
      }
    },
  }));
  app.get('*', (req, res, next) => {
    if (req.path.startsWith('/api/')) return next();
    res.sendFile(path.join(distPath, 'index.html'), err => {
      if (err) {
        logger.warn({ path: req.path, err: err.message }, 'Failed to serve index.html');
        res.status(200).send(`<!doctype html><html lang="en-US"><head><meta charset="UTF-8"><meta name="viewport" content="width=device-width, initial-scale=1.0"><title>Bridge Collective Opportunities</title></head><body><div id="root"></div></body></html>`);
      }
    });
  });

  if (Sentry) {
    app.use(Sentry.default.Handlers.errorHandler());
  }

  app.use(errorHandler);

  return { app, httpServer };
}
