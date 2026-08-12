import { Router } from 'express';
import pool from '../lib/db.js';

const router = Router();

router.get('/', async (req, res) => {
  try {
    const siteUrl = process.env.SITE_URL || 'https://bridgecollectiveopport.org';
    const { rows: opportunities } = await pool.query(
      "SELECT id, title, description, link, category, deadline, created_date, updated_date, image_url FROM opportunities WHERE status = 'active' ORDER BY created_date DESC LIMIT 50"
    );

    let xml = `<?xml version="1.0" encoding="UTF-8"?>\n`;
    xml += `<rss version="2.0" xmlns:atom="http://www.w3.org/2005/Atom" xmlns:dc="http://purl.org/dc/elements/1.1/">\n`;
    xml += `  <channel>\n`;
    xml += `    <title>Bridge Collective Opportunities</title>\n`;
    xml += `    <link>${siteUrl}</link>\n`;
    xml += `    <description>Discover scholarships, grants, jobs, internships, fellowships and more for youth.</description>\n`;
    xml += `    <language>en</language>\n`;
    xml += `    <atom:link href="${siteUrl}/api/rss.xml" rel="self" type="application/rss+xml"/>\n`;
    xml += `    <lastBuildDate>${new Date().toUTCString()}</lastBuildDate>\n`;

    for (const opp of opportunities) {
      const pubDate = opp.created_date ? new Date(opp.created_date).toUTCString() : '';
      const desc = (opp.description || '').replace(/<[^>]*>/g, '').substring(0, 500);
      xml += `    <item>\n`;
      xml += `      <title><![CDATA[${opp.title}]]></title>\n`;
      xml += `      <link>${siteUrl}/opportunities/${opp.id}</link>\n`;
      xml += `      <guid>${siteUrl}/opportunities/${opp.id}</guid>\n`;
      xml += `      <description><![CDATA[${desc}]]></description>\n`;
      xml += `      <category>${opp.category || 'General'}</category>\n`;
      if (pubDate) xml += `      <pubDate>${pubDate}</pubDate>\n`;
      if (opp.image_url) xml += `      <enclosure url="${opp.image_url}" type="image/jpeg"/>\n`;
      xml += `    </item>\n`;
    }

    xml += `  </channel>\n`;
    xml += `</rss>`;

    res.header('Content-Type', 'application/rss+xml; charset=utf-8');
    res.send(xml);
  } catch (err) {
    res.status(500).json({ error: 'Failed to generate RSS feed' });
  }
});

export default router;
