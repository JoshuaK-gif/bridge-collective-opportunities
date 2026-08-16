/**
 * Scraper helpers — port of server/lib/scraper.js with the AI (LLM) fallback
 * removed. Feed ingest, deadline/category classification (keyword-based),
 * drafts, publishing and logging all remain functional without AI.
 */
import crypto from 'crypto';
import { XMLParser } from 'fast-xml-parser';
import * as chrono from 'chrono-node';
import { query } from './db.js';
import logger from './logger.js';

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

/** Category keyword patterns: FIRST match wins, checked in priority order */
const CATEGORY_KEYWORD_RULES = [
  { name: 'scholarship', priority: 1, patterns: [/scholarship/i, /tuition/i, /academic\s+year/i, /undergraduate\s+(study|program|degree)/i, /postgraduate\s+(study|program|degree)/i, /master'?s\s+(degree|program|scholarship)/i, /phd\s+(scholarship|position|program)/i, /bachelor'?s\s+(scholarship|program)/i, /financial\s+aid/i, /merit\s+based/i, /fully?\s*funded\s+(scholarship|program)/i, /partial\s+(scholarship|funding)/i] },
  { name: 'job', priority: 2, patterns: [/hiring/i, /vacancy/i, /job\s+(title|opening|position|opportunity)/i, /employment/i, /recruit/i, /career\s+opportunity/i, /we\s+are\s+(hiring|looking\s+for|seeking)/i, /position\s+(is\s+)?open/i, /full[-\s]time/i, /salary/i, /remuneration/i, /cv\s+and\s+cover\s+letter/i] },
  { name: 'internship', priority: 3, patterns: [/internship/i, /intern\s+program/i, /graduate\s+(trainee|internship)/i, /industrial\s+attachment/i, /work\s+experience\s+program/i, /placement/i, /traineeship/i, /attachment\s+opportunity/i] },
  { name: 'grant', priority: 4, patterns: [/grant/i, /funding\s+(opportunity|program)/i, /research\s+(grant|funding)/i, /seed\s+funding/i, /small\s+grant/i, /project\s+grant/i, /innovation\s+(grant|fund)/i, /startup\s+(grant|funding)/i] },
  { name: 'fellowship', priority: 5, patterns: [/fellowship/i, /fellow\s+program/i, /postdoctoral/i, /research\s+(fellow|fellowship)/i, /leadership\s+program/i, /professional\s+fellow/i, /visiting\s+(scholar|fellow)/i, /residency/i] },
];

/** Minimum confidence threshold below which we flag for review */
const CATEGORY_CONFIDENCE_THRESHOLD = 0.5;

const VALID_CATEGORIES = ['scholarship', 'job', 'internship', 'grant', 'fellowship'];

/** Strip promotional filler phrases (ported from lib/rewriter.js — pure regex, no AI). */
function cleanPromotionalContent(text) {
  const patterns = [
    /start\s+your\s+journey/i,
    /click\s+here\s+(to\s+)?(apply|register|join|start)/i,
    /apply\s+now/i,
    /register\s+now/i,
    /join\s+(us\s+)?(today|now)/i,
    /don'?t\s+miss\s+(out\s+)?(on\s+)?(this\s+)?opportunity/i,
    /hurry\s+up/i,
    /limited\s+(slots|seats|spots|positions)/i,
    /apply\s+(before|early|today)/i,
    /sign\s+up\s+(now|today|free)/i,
    /get\s+started\s+(now|today)/i,
    /book\s+(your\s+)?(spot|seat|place|slot)\s+(now|today)/i,
    /enroll\s+(now|today)/i,
    /submit\s+(your\s+)?application\s+(now|today)/i,
    /learn\s+more\s+(now|today)/i,
    /take\s+(the\s+)?(next\s+)?step/i,
    /boost\s+your\s+(career|skills|future|chances)/i,
    /unlock\s+your\s+(potential|future|dream)/i,
    /transform\s+your\s+(life|career|future)/i,
    /this\s+is\s+your\s+chance/i,
    /what\s+are\s+you\s+waiting\s+for/i,
    /spaces?\s+(are\s+)?limited/i,
    /early\s+application\s+(is\s+)?encouraged/i,
    /first\s+come\s+first\s+served/i,
    /act\s+(fast|now|quickly)/i,
    /don'?t\s+delay/i,
    /seize\s+this\s+opportunity/i,
    /grab\s+this\s+opportunity/i,
  ];
  let cleaned = text;
  for (const p of patterns) {
    cleaned = cleaned.replace(p, '');
  }
  return cleaned.replace(/\s+/g, ' ').trim();
}

/**
 * Extract deadline using chrono-node for robust date parsing.
 * Returns { raw: string, iso: string|null } — iso is YYYY-MM-DD or null.
 */
function extractDeadline(text) {
  if (!text) return { raw: '', iso: null };

  const snippetPatterns = [
    /deadline[:\s]+(.{1,60})/i,
    /apply\s+by[:\s]+(.{1,60})/i,
    /due[:\s]+(.{1,60})/i,
    /closes[:\s]+(.{1,60})/i,
    /no\s+later\s+than[:\s]+(.{1,60})/i,
    /submission\s+(deadline|date)[:\s]+(.{1,60})/i,
    /application\s+(deadline|by|period|closing)[:\s]+(.{1,60})/i,
    /closing\s+date[:\s]+(.{1,60})/i,
    /end\s+date[:\s]+(.{1,60})/i,
    /last\s+date[:\s]+(.{1,60})/i,
    /final\s+date[:\s]+(.{1,60})/i,
    /applications?\s+close\s+(on|by)[:\s]+(.{1,60})/i,
    /deadline\s+for\s+(application|submission)[:\s]+(.{1,60})/i,
  ];
  for (const p of snippetPatterns) {
    const m = text.match(p);
    if (m) {
      const rawDate = m[m.length - 1].trim();
      const parsed = chrono.parseDate(rawDate, { forwardDate: false });
      if (parsed && !isNaN(parsed.getTime())) {
        const iso = parsed.toISOString().split('T')[0];
        return { raw: rawDate, iso };
      }
    }
  }

  const candidates = chrono.parse(text, { forwardDate: false });
  if (candidates.length > 0) {
    const best = candidates[0];
    const rawText = best.text.toLowerCase().trim();
    const durationPattern = /^(\s*for\s+|about\s+|approximately\s+)?\d+\s+(months?|years?|weeks?|days?|hours?|minutes?)$/i;
    const vaguePattern = /^(soon|immediately|asap|ongoing|rolling|tbd|tba|open|anytime|tba)$/i;
    if (durationPattern.test(rawText) || vaguePattern.test(rawText)) {
      return { raw: '', iso: null };
    }
    const parsed = best.date();
    if (parsed && !isNaN(parsed.getTime())) {
      const iso = parsed.toISOString().split('T')[0];
      return { raw: best.text, iso };
    }
  }

  return { raw: '', iso: null };
}

function validateDeadline(isoDate) {
  if (!isoDate) return 'deadline_unclear';
  const d = new Date(isoDate + 'T00:00:00Z');
  if (isNaN(d.getTime())) return 'deadline_unclear';
  const now = new Date();
  const twoYears = 2 * 365 * 24 * 60 * 60 * 1000;
  if (d < new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000)) return 'deadline_unclear';
  if (d.getTime() > now.getTime() + twoYears) return 'deadline_unclear';
  return null;
}

/** Classify opportunity using feed categories + keyword rules (no LLM). */
async function classifyCategory(title, description, feedCategories, userMap = {}) {
  const text = `${title}\n${description}`.toLowerCase();
  const mergedMap = { ...CATEGORY_DEFAULTS, ...userMap };

  for (const cat of feedCategories) {
    const lower = cat.toLowerCase();
    for (const vc of VALID_CATEGORIES) {
      if (lower.includes(vc)) return { category: vc, method: 'feed', confidence: 0.9 };
    }
  }

  let bestMatch = null;
  let bestScore = 0;
  for (const rule of CATEGORY_KEYWORD_RULES) {
    let score = 0;
    for (const p of rule.patterns) {
      const matches = text.match(p);
      if (matches) {
        const specificity = p.source.length;
        score += specificity * (matches.length || 1);
      }
    }
    if (score > bestScore) {
      bestScore = score;
      bestMatch = rule;
    }
  }

  if (bestMatch && bestScore > 50) {
    const confidence = Math.min(bestScore / 200, 0.95);
    if (confidence >= CATEGORY_CONFIDENCE_THRESHOLD) {
      return { category: bestMatch.name, method: 'keyword', confidence };
    }
  }

  return { category: 'scholarship', method: 'fallback', confidence: 0.1 };
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
  const text = cleanPromotionalContent(stripHtml(html));
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
  const result = await query("SELECT value FROM site_settings WHERE key = 'scraper_config'");
  if (result.rows.length) {
    return result.rows[0].value.category_map || {};
  }
  return {};
}

function buildDedupHash(title, deadline, organizationText) {
  const norm = (s) => (s || '').toLowerCase().replace(/[^a-z0-9\s]/g, '').replace(/\s+/g, ' ').trim();
  const parts = [norm(title).slice(0, 60), norm(deadline || ''), norm(organizationText).slice(0, 40)];
  return crypto.createHash('md5').update(parts.join('|')).digest('hex');
}

function extractOrganizationName(text) {
  const m = text.match(/([A-Z][A-Za-z0-9\s&]+?)\s+(offers|invites|announces|is\s+pleased|presents|launches|seeks|calls\s+for)/);
  return m ? m[1].trim() : '';
}

export async function getNewPosts(feedUrl, feedHealth) {
  const items = await fetchFeed(feedUrl);
  const categoryMap = await getCategoryMap();

  const [scrapedResult, oppResult, hashResult, oppHashResult] = await Promise.all([
    query('SELECT source_id FROM scraped_posts'),
    query("SELECT link FROM opportunities WHERE link IS NOT NULL AND link != ''"),
    query("SELECT dedup_hash FROM scraped_posts WHERE dedup_hash != ''"),
    query("SELECT dedup_hash FROM opportunities WHERE dedup_hash != ''"),
  ]);
  const existingScraped = new Set(scrapedResult.rows.map(r => r.source_id));
  const existingLinks = new Set(oppResult.rows.map(r => r.link));
  const existingHashes = new Set([
    ...hashResult.rows.map(r => r.dedup_hash),
    ...oppHashResult.rows.map(r => r.dedup_hash),
  ]);

  const newPosts = [];
  for (const item of items) {
    if (existingScraped.has(item.sourceId)) continue;
    if (!item.title || !item.link) continue;

    const contentText = item.content || item.description || '';
    const deadlineResult = extractDeadline(contentText);
    const deadlineValidation = validateDeadline(deadlineResult.iso);
    const classification = await classifyCategory(item.title, contentText, item.categories, categoryMap);
    const applyLink = extractLink(contentText);

    if (applyLink && existingLinks.has(applyLink)) continue;

    const dedupHash = buildDedupHash(item.title, deadlineResult.iso, extractOrganizationName(contentText));
    if (existingHashes.has(dedupHash)) continue;

    const imageUrl = extractImageUrl(contentText);
    const summary = getSummary(contentText);
    const category = classification.category;

    let itemStatus = 'scraped';
    let reviewReason = '';
    if (deadlineValidation) {
      reviewReason = deadlineValidation;
    } else if (classification.confidence < CATEGORY_CONFIDENCE_THRESHOLD && classification.method !== 'llm') {
      reviewReason = 'category_unclear';
    }
    if (reviewReason) {
      itemStatus = 'needs_review';
    }

    newPosts.push({
      ...item,
      deadline: deadlineResult.iso || '',
      deadlineRaw: deadlineResult.raw,
      applyLink,
      imageUrl,
      summary: summary || item.description,
      category,
      classificationMethod: classification.method,
      classificationConfidence: classification.confidence,
      dedupHash,
      status: itemStatus,
      reviewReason,
      source_feed: feedUrl,
    });
  }

  if (feedHealth && newPosts.length === 0) {
    try {
      await query(
        `INSERT INTO feed_health (feed_url, consecutive_empty_runs, updated_at)
         VALUES ($1, 1, now())
         ON CONFLICT (feed_url) DO UPDATE SET
           consecutive_empty_runs = feed_health.consecutive_empty_runs + 1,
           updated_at = now()`,
        [feedUrl]
      );
      const healthResult = await query('SELECT consecutive_empty_runs FROM feed_health WHERE feed_url = $1', [feedUrl]);
      if (healthResult.rows.length && healthResult.rows[0].consecutive_empty_runs >= 3) {
        logger.warn({ feedUrl, emptyRuns: healthResult.rows[0].consecutive_empty_runs }, 'Feed produced no new posts for 3+ consecutive runs — may be broken');
        await logAction('feed_health_warning', { feedUrl, consecutiveEmptyRuns: healthResult.rows[0].consecutive_empty_runs }, true);
      }
    } catch (e) {
      logger.warn({ err: e.message }, 'Failed to update feed health');
    }
  } else if (feedHealth && newPosts.length > 0) {
    try {
      await query(
        `INSERT INTO feed_health (feed_url, last_successful_run, consecutive_empty_runs, updated_at)
         VALUES ($1, now(), 0, now())
         ON CONFLICT (feed_url) DO UPDATE SET
           last_successful_run = now(),
           consecutive_empty_runs = 0,
           updated_at = now()`,
        [feedUrl]
      );
    } catch (e) {
      logger.warn({ err: e.message }, 'Failed to reset feed health');
    }
  }

  return newPosts;
}

export async function saveScrapedPost(post) {
  const structured = post.structured_data ? JSON.stringify(post.structured_data) : '{}';
  const deadlineDate = post.deadline || null;
  const status = post.status || 'scraped';
  const reviewReason = post.reviewReason || '';
  await query(
    `INSERT INTO scraped_posts (source_id, source_url, source_title, source_category, raw_content, image_url, deadline, deadline_date, apply_url, summary, structured_data, status, review_reason, dedup_hash, feed_url, classification_method, classification_confidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, $11, $12, $13, $14, $15, $16, $17)
     ON CONFLICT (source_id) DO UPDATE SET
       raw_content = EXCLUDED.raw_content,
       image_url = EXCLUDED.image_url,
       deadline = EXCLUDED.deadline,
       deadline_date = EXCLUDED.deadline_date,
       apply_url = EXCLUDED.apply_url,
       summary = EXCLUDED.summary,
       structured_data = EXCLUDED.structured_data,
       status = EXCLUDED.status,
       review_reason = EXCLUDED.review_reason,
       dedup_hash = EXCLUDED.dedup_hash,
       classification_method = EXCLUDED.classification_method,
       classification_confidence = EXCLUDED.classification_confidence`,
    [post.sourceId, post.link, post.title, post.category, post.content || '', post.imageUrl || '', post.deadline || '', deadlineDate, post.applyLink || '', post.summary || '', structured, status, reviewReason, post.dedupHash || '', post.source_feed || '', post.classificationMethod || '', post.classificationConfidence || 0]
  );
}

export async function saveDraftFromUrl(url) {
  const response = await fetch(url, {
    headers: { 'User-Agent': 'BridgeJobs/1.0 (Opportunity Aggregator)' },
    signal: AbortSignal.timeout(15000),
  });
  if (!response.ok) throw new Error(`Fetch failed: ${response.status}`);

  const html = await response.text();
  const title = html.match(/<title[^>]*>([^<]+)<\/title>/i)?.[1]?.trim() || 'Untitled';
  const desc = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i)?.[1] || '';
  const image = extractImageUrl(html);
  const deadlineResult = extractDeadline(html);
  const deadlineValidation = validateDeadline(deadlineResult.iso);
  const applyUrl = extractLink(html);

  const classification = await classifyCategory(title, desc, []);
  const dedupHash = buildDedupHash(title, deadlineResult.iso, extractOrganizationName(html));
  const reviewReason = deadlineValidation || '';
  const status = reviewReason ? 'needs_review' : 'scraped';

  const sourceId = `manual-${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;
  await query(
    `INSERT INTO scraped_posts (source_id, source_url, source_title, source_category, raw_content, image_url, deadline, deadline_date, apply_url, summary, structured_data, status, review_reason, dedup_hash, classification_method, classification_confidence)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8::date, $9, $10, '{}', $11, $12, $13, $14, $15)
     ON CONFLICT (source_id) DO NOTHING`,
    [sourceId, url, title, classification.category, html, image, deadlineResult.iso || '', deadlineResult.iso, applyUrl, desc, status, reviewReason, dedupHash, classification.method, classification.confidence]
  );
  return sourceId;
}

export async function updateDraft(id, fields) {
  const sets = [];
  const vals = [];
  let idx = 1;
  for (const [key, val] of Object.entries(fields)) {
    if (['edited_title', 'edited_description', 'edited_category', 'edited_image_url', 'edited_deadline', 'edited_apply_url', 'source_title', 'source_category', 'summary', 'image_url', 'deadline', 'apply_url', 'raw_content', 'structured_data'].includes(key)) {
      sets.push(`${key} = $${idx++}`);
      vals.push(val);
    }
  }
  if (sets.length === 0) return;
  vals.push(id);
  await query(
    `UPDATE scraped_posts SET ${sets.join(', ')} WHERE id = $${idx}`,
    vals
  );
}

export async function publishDraft(id, userId) {
  const draft = await query('SELECT * FROM scraped_posts WHERE id = $1', [id]);
  if (!draft.rows.length) throw new Error('Draft not found');
  const d = draft.rows[0];

  const title = d.edited_title || d.source_title || '';
  const description = d.edited_description || d.summary || '';
  const category = d.edited_category || d.source_category || 'Scholarship';
  const imageUrl = d.edited_image_url || d.image_url || '';
  const deadline = d.edited_deadline || d.deadline || null;
  const deadlineDate = d.deadline_date || null;
  const applyUrl = d.edited_apply_url || d.apply_url || d.source_url;

  const { v4: uuidv4 } = await import('uuid');
  const oppId = uuidv4();
  const structuredData = d.structured_data || {};
  await query(
    `INSERT INTO opportunities (id, title, description, link, image_url, category, deadline, deadline_date, status, created_by, created_date, updated_date, structured_data)
     VALUES ($1,$2,$3,$4,$5,$6,$7,$8::date,'active',$9,now(),now(),$10)`,
    [oppId, title, description, applyUrl, imageUrl, category, deadline, deadlineDate, userId, JSON.stringify(structuredData)]
  );

  await query(
    `UPDATE scraped_posts SET rewritten_title = $1, rewritten_description = $2, opportunity_id = $3, posted_to_website = true, posted_date = now(), status = 'published'
     WHERE id = $4`,
    [title, description, oppId, id]
  );

  return oppId;
}

export async function getUnprocessedPosts() {
  const result = await query(
    "SELECT * FROM scraped_posts WHERE status IN ('scraped', 'rewriting', 'needs_review', 'draft') ORDER BY created_date DESC"
  );
  return result.rows;
}

export async function getDraftById(id) {
  const result = await query('SELECT * FROM scraped_posts WHERE id = $1', [id]);
  return result.rows[0] || null;
}

export async function getPublishedPosts(limit = 50) {
  const result = await query(
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
  await query(
    'INSERT INTO auto_publish_log (action, details, success) VALUES ($1, $2, $3)',
    [action, JSON.stringify(details), success]
  );
}

export default { getNewPosts, saveScrapedPost, saveDraftFromUrl, updateDraft, publishDraft, getUnprocessedPosts, getDraftById, getPublishedPosts, logAction };
