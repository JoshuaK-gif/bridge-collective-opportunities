import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import rateLimit from 'express-rate-limit';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';
import { AppError } from '../lib/errors.js';
import { publishToSocial } from '../lib/social.js';
import { validate, opportunitySchema } from '../lib/validate.js';
import { logAudit } from '../lib/audit.js';
import { enrichOpportunity } from '../lib/enrich.js';
import { notifyNewOpportunity } from '../lib/email.js';
import { validateUrl } from '../lib/url-validator.js';
import cache from '../lib/cache.js';

const router = Router();

function invalidateListCache() {
  cache.del('opps:list');
  cache.del('opps:featured');
  cache.del('opps:expiring');
  cache.del('cats:list');
}

// Public submission rate limiter — 3 per hour per IP
const submitLimiter = rateLimit({
  windowMs: 60 * 60 * 1000,
  max: 3,
  message: { error: 'Too many submissions. Try again later.' },
  standardHeaders: true,
  legacyHeaders: false,
});

// POST /api/opportunities/submit — Public: anyone can submit an opportunity for review
router.post('/submit', submitLimiter, async (req, res, next) => {
  try {
    const { title, description, link, category, deadline, submitter_name, submitter_email, image_url, image_public_id } = req.body;
    if (!title || !title.trim()) throw new AppError(400, 'Title is required');
    if (title.length > 500) throw new AppError(400, 'Title too long (max 500 chars)');
    if (description && description.length > 10000) throw new AppError(400, 'Description too long (max 10,000 chars)');

    const id = uuidv4();
    const cleanTitle = title.trim();
    const cleanDesc = (description || '').trim();
    const cleanLink = (link || '').trim();
    const cleanCategory = (category || '').trim();
    const cleanDeadline = (deadline || '').trim();

    // Store submitter info in structured_data for admin review
    const structuredData = {
      submitted_by: submitter_name || 'Anonymous',
      submitter_email: submitter_email || '',
      submitted_at: new Date().toISOString(),
      type: 'user_submission',
    };

    // Find a fallback admin user for created_by
    const adminResult = await pool.query("SELECT id FROM users WHERE role = 'admin' ORDER BY created_date ASC LIMIT 1");
    const adminId = adminResult.rows[0]?.id;
    if (!adminId) throw new AppError(500, 'No admin configured');

    await pool.query(
      `INSERT INTO opportunities (id, title, description, link, category, deadline, status, created_by, created_date, updated_date, structured_data, image_url, image_public_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, now(), now(), $8, $9, $10)`,
      [id, cleanTitle, cleanDesc, cleanLink, cleanCategory, cleanDeadline, adminId, JSON.stringify(structuredData), image_url || '', image_public_id || '']
    );

    logger.info({ opportunityId: id, submitter: submitter_email || 'anonymous' }, 'Public opportunity submitted');
    res.status(201).json({ success: true, message: 'Your opportunity has been submitted for review.' });
  } catch (err) {
    next(err);
  }
});

router.get('/', async (req, res, next) => {
  try {
    const { category, search, trending, featured, all, expiring_soon, expiring_within } = req.query;

    // Only cache common public queries (no search, no admin all)
    const cacheKey = `opps:${featured === 'true' ? 'featured' : expiring_soon === 'true' ? `expiring:${expiring_within || 7}` : 'list'}`;
    if (!search && all !== 'true' && !category && !trending) {
      const cached = await cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    let query = 'SELECT * FROM opportunities';
    const conditions = [];
    const params = [];
    let idx = 1;
    if (all !== 'true') {
      conditions.push(`status = $${idx++}`);
      params.push('active');
    }
    if (category) {
      conditions.push(`category = $${idx++}`);
      params.push(category);
    }
    if (search) {
      conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
      params.push(`%${search}%`);
      idx++;
    }
    if (trending === 'true') {
      conditions.push('trending = true');
    }
    if (featured === 'true') {
      conditions.push('featured_order IS NOT NULL');
    }
    if (expiring_soon === 'true') {
      let days = Math.max(1, parseInt(expiring_within, 10) || 7);
      if (days > 365) days = 365;
      conditions.push(`deadline != '' AND deadline IS NOT NULL`);
      conditions.push(`TO_DATE(deadline, 'YYYY-MM-DD') >= CURRENT_DATE`);
      conditions.push(`TO_DATE(deadline, 'YYYY-MM-DD') <= CURRENT_DATE + $${idx++}::interval`);
      params.push(`${days} days`);
    }
    if (conditions.length) {
      query += ' WHERE ' + conditions.join(' AND ');
    }
    if (featured === 'true') {
      query += ' ORDER BY featured_order ASC';
    } else if (expiring_soon === 'true') {
      query += " ORDER BY TO_DATE(deadline, 'YYYY-MM-DD') ASC";
    } else {
      query += ' ORDER BY created_date DESC';
    }
    const result = await pool.query(query, params);

    // Cache common queries for 60s
    if (!search && all !== 'true' && !category && !trending) {
      cache.set(cacheKey, result.rows, 60);
    }

    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/check-duplicates', async (req, res, next) => {
  try {
    const { title, link, exclude } = req.query;
    if (!title && !link) return res.json({ duplicates: [] });
    const conditions = [];
    const params = [];
    let idx = 1;
    if (title) {
      conditions.push(`title ILIKE $${idx} OR position(lower($${idx}) in lower(title)) > 0`);
      params.push(`%${title}%`);
      idx++;
    }
    if (link) {
      conditions.push(`link = $${idx} OR link IS NOT NULL AND link != '' AND $${idx} != '' AND (link = $${idx} OR position($${idx} in link) > 0 OR position(link in $${idx}) > 0)`);
      params.push(link);
      idx++;
    }
    let excludeParamIdx = null;
    if (exclude) {
      excludeParamIdx = idx;
      params.push(exclude);
      idx++;
    }
    let whereClause = `(${conditions.join(' OR ')})`;
    if (excludeParamIdx) {
      whereClause += ` AND id != $${excludeParamIdx}`;
    }
    const result = await pool.query(
      `SELECT id, title, link, category, deadline, status, created_date FROM opportunities WHERE ${whereClause} ORDER BY created_date DESC LIMIT 5`,
      params
    );
    res.json({ duplicates: result.rows });
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query("SELECT * FROM opportunities WHERE id = $1", [req.params.id]);
    if (!result.rows.length) throw new AppError(404, 'Opportunity not found');
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, validate(opportunitySchema), async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { title, description, link, image_url, image_public_id, image_crop, image_size, category, deadline, status, publish_at } = req.body;
    const id = uuidv4();
    const finalStatus = status === 'draft' ? 'draft' : (publish_at ? 'draft' : 'active');
    await pool.query(
      `INSERT INTO opportunities (id, title, description, link, image_url, image_public_id, image_crop, image_size, category, deadline, status, created_by, created_date, updated_date, publish_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now(),$13)`,
      [id, title, description || '', link || '', image_url || '', image_public_id || '', image_crop ? JSON.stringify(image_crop) : null, image_size || 'medium', category || '', deadline || '', finalStatus, req.user.id, publish_at || null]
    );
    logAudit({ userId: req.user.id, action: 'create', entityType: 'opportunity', entityId: id, ipAddress: req.ip });
    logger.info({ opportunityId: id, status: finalStatus }, 'Opportunity created');
    if (finalStatus === 'active') {
      // Notify subscribers about the new opportunity
      const oppData = { id, title, description, image_url, category, deadline };
      notifyNewOpportunity(oppData).then(results => {
        if (results?.sent > 0) {
          logger.info({ opportunityId: id, sent: results.sent }, 'Instant notification sent to subscribers');
        }
      }).catch(err => {
        logger.error({ opportunityId: id, err: err.message }, 'Instant notification failed');
      });

      publishToSocial(title, description || '', `${req.protocol}://${req.get('host')}/opportunities/${id}`, image_url || '').then(results => {
        logger.info({ opportunityId: id, results }, 'Social publishing results');
      }).catch(err => {
        logger.error({ opportunityId: id, err: err.message }, 'Social publishing failed');
      });
    }
    invalidateListCache();
    res.status(201).json({ id, success: true, status: finalStatus });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { title, description, link, image_url, image_public_id, image_crop, image_size, category, deadline, status, trending, featured_order } = req.body;

    // Build update dynamically so nullable fields can be set to null
    const sets = [];
    const params = [];
    let idx = 1;

    const fieldMap = { title, description, link, image_url, image_public_id, image_size, category, deadline, status, trending };
    for (const [key, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        sets.push(`${key} = $${idx++}`);
        params.push(val);
      }
    }

    // Handle image_crop separately (JSON serialization)
    if (image_crop !== undefined) {
      sets.push(`image_crop = $${idx++}`);
      params.push(image_crop ? JSON.stringify(image_crop) : null);
    }

    // Handle featured_order separately (must allow setting to null)
    if ('featured_order' in req.body) {
      sets.push(`featured_order = $${idx++}`);
      params.push(featured_order ?? null);
    }

    if (!sets.length) throw new AppError(400, 'No fields to update');
    sets.push('updated_date = now()');
    params.push(req.params.id);

    const result = await pool.query(
      `UPDATE opportunities SET ${sets.join(', ')} WHERE id = $${idx}`,
      params
    );
    if (!result.rowCount) throw new AppError(404, 'Opportunity not found');
    logAudit({ userId: req.user.id, action: 'update', entityType: 'opportunity', entityId: req.params.id, metadata: { fields: Object.keys(req.body) }, ipAddress: req.ip });
    invalidateListCache();
    logger.info({ opportunityId: req.params.id }, 'Opportunity updated');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.post('/bulk/delete', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) throw new AppError(400, 'ids array is required');
    const result = await pool.query('DELETE FROM opportunities WHERE id = ANY($1::uuid[])', [ids]);
    logAudit({ userId: req.user.id, action: 'bulk_delete', entityType: 'opportunity', metadata: { count: ids.length }, ipAddress: req.ip });
    invalidateListCache();
    logger.info({ count: result.rowCount }, 'Bulk opportunities deleted');
    res.json({ success: true, deleted: result.rowCount });
  } catch (err) {
    next(err);
  }
});

router.post('/bulk/update', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { ids, data } = req.body;
    if (!Array.isArray(ids) || !ids.length) throw new AppError(400, 'ids array is required');
    if (!data || typeof data !== 'object') throw new AppError(400, 'data object is required');
    const sets = [];
    const params = [ids];
    let idx = 2;
    for (const [key, value] of Object.entries(data)) {
      if (['title', 'description', 'status', 'category', 'trending', 'featured_order', 'deadline'].includes(key)) {
        sets.push(`${key} = $${idx++}`);
        params.push(value);
      }
    }
    if (!sets.length) throw new AppError(400, 'No valid fields to update');
    sets.push('updated_date = now()');
    const result = await pool.query(`UPDATE opportunities SET ${sets.join(', ')} WHERE id = ANY($1::uuid[])`, params);
    invalidateListCache();
    logger.info({ count: result.rowCount }, 'Bulk opportunities updated');
    res.json({ success: true, updated: result.rowCount });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// AI Enrichment — Generate full structured description for an opportunity
// Uses shared enrichment utility from lib/enrich.js
// ---------------------------------------------------------------------------
router.post('/:id/enrich', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');

    const result = await enrichOpportunity(req.params.id);
    if (!result) throw new AppError(502, 'AI enrichment failed — the AI returned an unparseable response. Try again.');

    logAudit({ userId: req.user.id, action: 'enrich', entityType: 'opportunity', entityId: req.params.id, ipAddress: req.ip });
    logger.info({ opportunityId: req.params.id }, 'Opportunity enriched with AI description');

    res.json({
      success: true,
      opportunityId: req.params.id,
      title: result.title,
      description: result.description,
      structured_data: result.structured_data,
      keywords: result.keywords,
    });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const result = await pool.query('DELETE FROM opportunities WHERE id = $1', [req.params.id]);
    if (!result.rowCount) throw new AppError(404, 'Opportunity not found');
    logAudit({ userId: req.user.id, action: 'delete', entityType: 'opportunity', entityId: req.params.id, ipAddress: req.ip });
    invalidateListCache();
    logger.info({ opportunityId: req.params.id }, 'Opportunity deleted');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Duplicate an opportunity — creates a new one with the same fields
// ---------------------------------------------------------------------------
router.post('/:id/duplicate', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const result = await pool.query('SELECT * FROM opportunities WHERE id = $1', [req.params.id]);
    if (!result.rows.length) throw new AppError(404, 'Opportunity not found');
    const opp = result.rows[0];
    const newId = uuidv4();
    await pool.query(
      `INSERT INTO opportunities (id, title, description, link, image_url, image_public_id, image_crop, image_size, category, deadline, status, created_by, created_date, updated_date, structured_data, publish_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11,now(),now(),$12,$13)`,
      [newId, opp.title + ' (Copy)', opp.description, opp.link, opp.image_url, opp.image_public_id, opp.image_crop, opp.image_size, opp.category, opp.deadline, req.user.id, opp.structured_data || '{}', null]
    );
    logAudit({ userId: req.user.id, action: 'duplicate', entityType: 'opportunity', entityId: newId, ipAddress: req.ip });
    res.status(201).json({ id: newId, success: true });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Bulk publish drafts from scraped_posts
// ---------------------------------------------------------------------------
router.post('/bulk/publish', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { ids } = req.body;
    if (!Array.isArray(ids) || !ids.length) throw new AppError(400, 'ids array is required');

    const draftResult = await pool.query("SELECT * FROM scraped_posts WHERE id = ANY($1::uuid[]) AND status = 'draft'", [ids]);
    let published = 0;
    for (const d of draftResult.rows) {
      const title = d.edited_title || d.source_title || '';
      const description = d.edited_description || d.summary || '';
      const category = d.edited_category || d.source_category || 'Scholarship';
      const imageUrl = d.edited_image_url || d.image_url || '';
      const deadline = d.edited_deadline || d.deadline || null;
      const applyUrl = d.edited_apply_url || d.apply_url || d.source_url;
      const oppId = uuidv4();
      const structuredData = d.structured_data || {};
      await pool.query(
        `INSERT INTO opportunities (id, title, description, link, image_url, category, deadline, status, created_by, created_date, updated_date, structured_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,now(),now(),$9)`,
        [oppId, title, description, applyUrl, imageUrl, category, deadline, req.user.id, JSON.stringify(structuredData)]
      );
      await pool.query(
        `UPDATE scraped_posts SET rewritten_title = $1, rewritten_description = $2, opportunity_id = $3, posted_to_website = true, posted_date = now(), status = 'published'
         WHERE id = $4`,
        [title, description, oppId, d.id]
      );
      notifyNewOpportunity({ id: oppId, title, description, image_url: imageUrl, category, deadline }).catch(err => {
        logger.error({ opportunityId: oppId, err: err.message }, 'Bulk publish notification failed');
      });
      published++;
    }
    logAudit({ userId: req.user.id, action: 'bulk_publish', entityType: 'scraped_posts', metadata: { count: published }, ipAddress: req.ip });
    res.json({ success: true, published });
  } catch (err) {
    next(err);
  }
});

// ---------------------------------------------------------------------------
// Clone from URL — fetch a URL, AI-extract opportunity data, return as pre-fill
// ---------------------------------------------------------------------------
router.post('/clone-from-url', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { url } = req.body;
    if (!url) throw new AppError(400, 'URL is required');

    const validation = validateUrl(url);
    if (!validation.valid) throw new AppError(400, validation.error);

    const response = await fetch(url, {
      headers: { 'User-Agent': 'BridgeJobs/1.0 (Opportunity Aggregator)' },
      signal: AbortSignal.timeout(15000),
    });
    if (!response.ok) throw new AppError(400, `Failed to fetch URL: ${response.status}`);
    const html = await response.text();

    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
    const extractedTitle = (titleMatch?.[1] || '').trim();
    const extractedDesc = (descMatch?.[1] || '').trim();

    const cleanText = html
      .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
      .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
      .replace(/<[^>]+>/g, ' ')
      .replace(/&nbsp;/g, ' ')
      .replace(/\s+/g, ' ')
      .trim()
      .slice(0, 3000);

    const prompt = `Extract opportunity details from this webpage content. Return ONLY valid JSON with these fields: title, description (2-3 sentence summary), category, deadline (in YYYY-MM-DD format if found), link (the apply URL if found), organization, location, funding. If a field is not found, use empty string. Do NOT fabricate.
    
Webpage content: "${cleanText.slice(0, 2000)}"`;

    const aiConfig = await (await import('../lib/enrich.js')).getAiConfig();
    let extracted = {};
    try {
      const aiContent = await (await import('../lib/enrich.js')).callEnrichAI(prompt, aiConfig);
      extracted = (await import('../lib/enrich.js')).safeParseEnrich(aiContent);
    } catch {
      // fallback to basic extraction
    }

    res.json({
      title: extracted.title || extractedTitle,
      description: extracted.description || extractedDesc,
      category: extracted.category || 'Scholarship',
      deadline: extracted.deadline || '',
      link: extracted.link || url,
      organization: extracted.organization || '',
      location: extracted.location || '',
      funding: extracted.funding || '',
    });
  } catch (err) {
    next(err);
  }
});

export default router;
