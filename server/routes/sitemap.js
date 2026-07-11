import { Router } from 'express';
import pool from '../lib/db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const { rows: opportunities } = await pool.query(
      "SELECT id, title, updated_date, created_date, category FROM opportunities WHERE status = 'active' ORDER BY updated_date DESC"
    );

    const siteUrl = process.env.SITE_URL || 'https://bridgejobs.ug';

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n`;

    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'daily' },
      { loc: '/about', priority: '0.7', changefreq: 'monthly' },
      { loc: '/services', priority: '0.7', changefreq: 'monthly' },
      { loc: '/contact', priority: '0.6', changefreq: 'monthly' },
      { loc: '/privacy-policy', priority: '0.3', changefreq: 'yearly' },
      { loc: '/terms', priority: '0.3', changefreq: 'yearly' },
    ];

    for (const page of staticPages) {
      xml += `  <url>\n`;
      xml += `    <loc>${siteUrl}${page.loc}</loc>\n`;
      xml += `    <priority>${page.priority}</priority>\n`;
      xml += `    <changefreq>${page.changefreq}</changefreq>\n`;
      xml += `  </url>\n`;
    }

    for (const opp of opportunities) {
      const lastmod = opp.updated_date || opp.created_date;
      xml += `  <url>\n`;
      xml += `    <loc>${siteUrl}/opportunities/${opp.id}</loc>\n`;
      xml += `    <lastmod>${new Date(lastmod).toISOString()}</lastmod>\n`;
      xml += `    <priority>0.8</priority>\n`;
      xml += `    <changefreq>weekly</changefreq>\n`;
      xml += `  </url>\n`;
    }

    xml += `</urlset>`;

    res.header('Content-Type', 'application/xml');
    res.send(xml);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate sitemap' });
  }
});

export default router;
