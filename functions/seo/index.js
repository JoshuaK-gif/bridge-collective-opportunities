/**
 * GET /v1/seo?type=sitemap — XML sitemap
 * GET /v1/seo?type=rss     — RSS feed
 */
import { query } from '../_shared/db.js';
import { handle } from '../_shared/errors.js';

export default handle(async (req, res) => {
  const type = req.query?.type || 'sitemap';
  const siteUrl = process.env.SITE_URL || 'https://bridgecollectiveopport.org';

  if (type === 'sitemap') {
    const { rows: opportunities } = await query(
      "SELECT id, title, updated_date, created_date, category FROM opportunities WHERE status = 'active' ORDER BY updated_date DESC"
    );

    let xml = '<?xml version="1.0" encoding="UTF-8"?>\n';
    xml += '<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n';

    const today = new Date().toISOString();
    const staticPages = [
      { loc: '/', priority: '1.0', changefreq: 'daily', lastmod: today },
      { loc: '/about', priority: '0.7', changefreq: 'monthly', lastmod: today },
      { loc: '/services', priority: '0.7', changefreq: 'monthly', lastmod: today },
      { loc: '/contact', priority: '0.6', changefreq: 'monthly', lastmod: today },
      { loc: '/cv-builder', priority: '0.6', changefreq: 'monthly', lastmod: today },
      { loc: '/cv-tips', priority: '0.6', changefreq: 'monthly', lastmod: today },
      { loc: '/privacy-policy', priority: '0.3', changefreq: 'yearly', lastmod: today },
      { loc: '/terms-of-service', priority: '0.3', changefreq: 'yearly', lastmod: today },
    ];

    for (const page of staticPages) {
      xml += '  <url>\n';
      xml += '    <loc>' + siteUrl + page.loc + '</loc>\n';
      xml += '    <lastmod>' + page.lastmod + '</lastmod>\n';
      xml += '    <priority>' + page.priority + '</priority>\n';
      xml += '    <changefreq>' + page.changefreq + '</changefreq>\n';
      xml += '  </url>\n';
    }

    for (const opp of opportunities) {
      const lastmod = opp.updated_date || opp.created_date;
      xml += '  <url>\n';
      xml += '    <loc>' + siteUrl + '/opportunities/' + opp.id + '</loc>\n';
      xml += '    <lastmod>' + new Date(lastmod).toISOString() + '</lastmod>\n';
      xml += '    <priority>0.8</priority>\n';
      xml += '    <changefreq>weekly</changefreq>\n';
      xml += '  </url>\n';
    }

    xml += '</urlset>';
    res.set('Content-Type', 'application/xml');
    return res.send(xml);
  }

  if (type === 'rss') {
    const { rows: opportunities } = await query(
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
    res.set('Content-Type', 'application/rss+xml; charset=utf-8');
    return res.send(xml);
  }

  res.status(400).json({ error: 'type must be sitemap or rss' });
});
