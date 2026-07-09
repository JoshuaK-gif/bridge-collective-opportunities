import { XMLParser } from 'fast-xml-parser';
import pool from './db.js';
import logger from './logger.js';
import cache from './cache.js';

const CACHE_KEY = 'scraper:last_fetch';
const CACHE_TTL = 300;

const CATEGORY_DEFAULTS = {
  Scholarships: 'Scholarship',
  Grants: 'Grant',
  Jobs: 'Job',
  Internships: 'Internship',
  Fellowship: 'Fellowship',
  Training: 'Training',
  Volunteer: 'Volunteer',
  Awards: 'Grant',
  Conferences: 'Training',
  'Short Courses': 'Training',
};

function extractDeadline(html) {
  const patterns = [
    /deadline[:\s]+([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
    /deadline[:\s]+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    /due[:\s]+([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
    /due[:\s]+(\d{1,2}\s+[A-Za-z]+\s+\d{4})/i,
    /no later than\s+([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
    /by\s+([A-Za-z]+\s+\d{1,2},?\s*\d{4})/i,
  ];
  for (const p of patterns) {
    const m = html.match(p);
    if (m) return m[1].trim();
  }
  return '';
}

function extractLink(html) {
  const linkPatterns = [
    /<a[^>]*href="([^"]*apply[^"]*)"[^>]*>/i,
    /<a[^>]*href="([^"]*register[^"]*)"[^>]*>/i,
    /<a[^>]*href="([^"]*career[^"]*)"[^>]*>/i,
    /<a[^>]*href="([^"]*careers[^"]*)"[^>]*>/i,
    /<a[^>]*href="([^"]*job[^"]*)"[^>]*>/i,
    /<a[^>]*href="([^"]*scholarship[^"]*)"[^>]*>/i,
  ];
  for (const p of linkPatterns) {
    const m = html.match(p);
    if (m) return m[1];
  }
  return '';
}

function extractImageUrl(html) {
  const m = html.match(/<img[^>]+src="([^"]+)"[^>]*>/i);
  return m ? m[1] : '';
}

function stripHtml(html) {
  return html
    .replace(/<\/?[^>]+(>|$)/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&#\d+;/g, ' ')
    .replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<')
    .replace(/&gt;/g, '>')
    .replace(/&quot;/g, '"')
    .replace(/&#039;/g, "'")
    .replace(/\s+/g, ' ')
    .trim();
}

function getSummary(html) {
  const text = stripHtml(html);
  const sentences = text.split(/\.\s+/);
  let summary = '';
  for (const s of sentences) {
    if ((summary + s).length > 300) break;
    summary += s + '. ';
  }
  return summary.trim();
}

function mapCategory(ofyCategories, userMap = {}) {
  const merged = { ...CATEGORY_DEFAULTS, ...userMap };
  for (const cat of ofyCategories) {
    const mapped = merged[cat];
    if (mapped) return mapped;
    const lower = cat.toLowerCase();
    if (lower.includes('scholar') || lower.includes('fellowship')) return 'Scholarship';
    if (lower.includes('grant') || lower.includes('award') || lower.includes('prize')) return 'Grant';
    if (lower.includes('job') || lower.includes('intern')) return 'Job';
    if (lower.includes('internship')) return 'Internship';
    if (lower.includes('training') || lower.includes('course') || lower.includes('workshop')) return 'Training';
    if (lower.includes('volunteer')) return 'Volunteer';
  }
  return 'Scholarship';
}

export async function fetchFeed(feedUrl) {
  const response = await fetch(feedUrl, {
    headers: { 'User-Agent': 'BridgeJobs/1.0 (Opportunity Aggregator)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Feed fetch failed: ${response.status}`);
  const xml = await response.text();
  const parser = new XMLParser({
    ignoreAttributes: false,
    attributeNamePrefix: '@_',
    isArray: (name) => ['item', 'category'].includes(name),
  });
  const data = parser.parse(xml);
  const items = data.rss?.channel?.item || [];
  return items.map(item => ({
    sourceId: String(item['post-id']?.['#text'] || item['post-id'] || item.guid?.['#text'] || item.guid || ''),
    title: item.title?.trim() || '',
    link: item.link?.trim() || '',
    categories: (item.category || []).map(c => c.trim()),
    pubDate: item.pubDate || '',
    description: item.description
      ? stripHtml(item.description.split('<p>The post')[0])
      : '',
    content: item['content:encoded'] || '',
  }));
}

export async function getCategoryMap() {
  const result = await pool.query("SELECT value FROM site_settings WHERE key = 'scraper_config'");
  if (result.rows.length) {
    return result.rows[0].value.category_map || {};
  }
  return {};
}

export async function getNewPosts(feedUrl) {
  const items = await fetchFeed(feedUrl);
  const categoryMap = await getCategoryMap();
  const result = await pool.query('SELECT source_id FROM scraped_posts');
  const existing = new Set(result.rows.map(r => r.source_id));

  const newPosts = [];
  for (const item of items) {
    if (existing.has(item.sourceId)) continue;
    if (!item.title || !item.link) continue;
    const deadline = extractDeadline(item.content || item.description);
    const applyLink = extractLink(item.content || item.description);
    const imageUrl = extractImageUrl(item.content || item.description);
    const summary = getSummary(item.content || item.description);
    const category = mapCategory(item.categories, categoryMap);

    newPosts.push({
      ...item,
      deadline,
      applyLink: applyLink || item.link,
      imageUrl,
      summary: summary || item.description,
      category,
    });
  }
  return newPosts;
}

export async function saveScrapedPost(post) {
  await pool.query(
    `INSERT INTO scraped_posts (source_id, source_url, source_title, source_category)
     VALUES ($1, $2, $3, $4)
     ON CONFLICT (source_id) DO NOTHING`,
    [post.sourceId, post.link, post.title, post.category]
  );
}

export async function getUnprocessedPosts() {
  const result = await pool.query(
    "SELECT * FROM scraped_posts WHERE opportunity_id IS NULL ORDER BY created_date DESC"
  );
  return result.rows;
}

export async function getPublishedPosts(limit = 50) {
  const result = await pool.query(
    `SELECT sp.*, o.title as opp_title, o.description as opp_description
     FROM scraped_posts sp
     LEFT JOIN opportunities o ON sp.opportunity_id = o.id
     WHERE sp.opportunity_id IS NOT NULL
     ORDER BY sp.posted_date DESC NULLS LAST, sp.created_date DESC
     LIMIT $1`,
    [limit]
  );
  return result.rows;
}

export async function logAction(action, details, success = true) {
  await pool.query(
    'INSERT INTO auto_publish_log (action, details, success) VALUES ($1, $2, $3)',
    [action, JSON.stringify(details), success]
  );
}
