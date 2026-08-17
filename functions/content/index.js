/**
 * /v1/content — opportunities + categories + news + related + unsubscribe.
 *
 * Nhost Functions use static routes, so resources are addressed with query
 * params (GET) or { resource, action } bodies (POST). All SQL is ported
 * verbatim from the Express routes; AI-dependent endpoints (enrich,
 * clone-from-url AI extraction) are disabled with a clear 501.
 *
 * GET  /v1/content?resource=opportunities&category&search&trending&featured&all&expiring_soon&expiring_within
 * GET  /v1/content?resource=opportunity&id=
 * GET  /v1/content?resource=check-duplicates&title&link&exclude
 * GET  /v1/content?resource=categories
 * GET  /v1/content?resource=category&id=
 * GET  /v1/content?resource=news&limit=
 * GET  /v1/content?resource=news-item&id=
 * GET  /v1/content?resource=related&id=
 * GET  /v1/content?resource=unsubscribe&email&id
 *
 * POST /v1/content  { resource: 'opportunity', action: 'create'|'update'|'delete'|'duplicate'|'bulk-delete'|'bulk-update'|'bulk-publish'|'submit'|'clone-from-url', ... }
 * POST /v1/content  { resource: 'category', action: 'create'|'update'|'delete', ... }
 * POST /v1/content  { resource: 'news', action: 'create'|'update'|'delete', ... }
 */
import { v4 as uuidv4 } from 'uuid';
import { query } from '../_shared/db.js';
import logger from '../_shared/logger.js';
import { requireAdmin, requireAuth } from '../_shared/auth.js';
import { AppError, handle } from '../_shared/errors.js';
import { parseWith, opportunitySchema, categorySchema } from '../_shared/validate.js';
import { logAudit } from '../_shared/audit.js';
import { notifyNewOpportunity } from '../_shared/email.js';
import { publishToSocial } from '../_shared/social.js';
import { validateUrl } from '../_shared/url-validator.js';
import cache from '../_shared/cache.js';

function invalidateListCache() {
  cache.del('opps:list');
  cache.del('opps:featured');
  cache.del('opps:expiring');
  cache.del('cats:list');
}

/* ---------------------------------- GET ---------------------------------- */

async function handleGet(req, res) {
  const q = req.query || {};
  const resource = q.resource;

  if (resource === 'opportunities') {
    const { category, search, trending, featured, all, expiring_soon, expiring_within } = q;

    const cacheKey = `opps:${featured === 'true' ? 'featured' : expiring_soon === 'true' ? `expiring:${expiring_within || 7}` : 'list'}`;
    if (!search && all !== 'true' && !category && !trending) {
      const cached = await cache.get(cacheKey);
      if (cached) return res.json(cached);
    }

    let sql = 'SELECT * FROM opportunities';
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
      sql += ' WHERE ' + conditions.join(' AND ');
    }
    if (featured === 'true') {
      sql += ' ORDER BY featured_order ASC';
    } else if (expiring_soon === 'true') {
      sql += " ORDER BY TO_DATE(deadline, 'YYYY-MM-DD') ASC";
    } else {
      sql += ' ORDER BY created_date DESC';
    }
    const result = await query(sql, params);

    if (!search && all !== 'true' && !category && !trending) {
      cache.set(cacheKey, result.rows, 60);
    }
    return res.json(result.rows);
  }

  if (resource === 'opportunity') {
    const result = await query('SELECT * FROM opportunities WHERE id = $1', [q.id]);
    if (!result.rows.length) throw new AppError(404, 'Opportunity not found');
    return res.json(result.rows[0]);
  }

  if (resource === 'check-duplicates') {
    const { title, link, exclude } = q;
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
    const result = await query(
      `SELECT id, title, link, category, deadline, status, created_date FROM opportunities WHERE ${whereClause} ORDER BY created_date DESC LIMIT 5`,
      params
    );
    return res.json({ duplicates: result.rows });
  }

  if (resource === 'categories') {
    const cached = await cache.get('cats:list');
    if (cached) return res.json(cached);
    const result = await query('SELECT * FROM categories ORDER BY name ASC');
    cache.set('cats:list', result.rows, 120);
    return res.json(result.rows);
  }

  if (resource === 'category') {
    const result = await query('SELECT * FROM categories WHERE id = $1', [q.id]);
    if (!result.rows.length) throw new AppError(404, 'Category not found');
    return res.json(result.rows[0]);
  }

  if (resource === 'news') {
    const limit = Math.min(parseInt(q.limit, 10) || 50, 200);
    const result = await query('SELECT * FROM news ORDER BY published_date DESC LIMIT $1', [limit]);
    return res.json(result.rows);
  }

  if (resource === 'news-item') {
    const result = await query('SELECT * FROM news WHERE id = $1', [q.id]);
    if (!result.rows.length) throw new AppError(404, 'News not found');
    return res.json(result.rows[0]);
  }

  if (resource === 'related') {
    const opp = await query('SELECT category, id FROM opportunities WHERE id = $1', [q.id]);
    if (!opp.rows.length) return res.json([]);
    const { category, id } = opp.rows[0];
    const result = await query(
      "SELECT id, title, image_url, category, deadline, created_date FROM opportunities WHERE category = $1 AND id != $2 AND status = 'active' ORDER BY created_date DESC LIMIT 4",
      [category, id]
    );
    return res.json(result.rows);
  }

  if (resource === 'unsubscribe') {
    const { email, id } = q;
    if (!email) return res.status(400).json({ error: 'Email is required' });
    await query(
      "UPDATE subscribers SET unsubscribed_at = now(), is_active = false WHERE email = $1 AND ($2::uuid IS NULL OR id = $2::uuid)",
      [email, id || null]
    );
    res.set('Content-Type', 'text/html');
    return res.send(`<!DOCTYPE html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Unsubscribed</title><style>body{font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',Arial,sans-serif;display:flex;align-items:center;justify-content:center;min-height:100vh;margin:0;background:#f4f4f6;}.card{background:#fff;padding:40px;border-radius:12px;text-align:center;box-shadow:0 1px 4px rgba(0,0,0,.08);max-width:400px;}h1{font-size:20px;color:#333;margin:0 0 8px;}p{font-size:14px;color:#666;margin:0;}</style></head><body><div class="card"><h1>Unsubscribed</h1><p>You have been unsubscribed from Bridge Collective Opportunities emails. You will no longer receive daily updates.</p></div></body></html>`);
  }

  throw new AppError(404, `Unknown resource: ${resource}`);
}

/* ---------------------------------- POST ---------------------------------- */

async function handleOpportunityAction(body, user, req, res) {
  const action = body.action;

  if (action === 'submit') {
    const { title, description, link, category, deadline, submitter_name, submitter_email, image_url, image_public_id } = body;
    if (!title || !title.trim()) throw new AppError(400, 'Title is required');
    if (title.length > 500) throw new AppError(400, 'Title too long (max 500 chars)');
    if (description && description.length > 10000) throw new AppError(400, 'Description too long (max 10,000 chars)');

    const id = uuidv4();
    const structuredData = {
      submitted_by: submitter_name || 'Anonymous',
      submitter_email: submitter_email || '',
      submitted_at: new Date().toISOString(),
      type: 'user_submission',
    };
    const adminResult = await query("SELECT id FROM users WHERE role = 'admin' ORDER BY created_date ASC LIMIT 1");
    const adminId = adminResult.rows[0]?.id;
    if (!adminId) throw new AppError(500, 'No admin configured');

    await query(
      `INSERT INTO opportunities (id, title, description, link, category, deadline, status, created_by, created_date, updated_date, structured_data, image_url, image_public_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, now(), now(), $8, $9, $10)`,
      [id, title.trim(), (description || '').trim(), (link || '').trim(), (category || '').trim(), (deadline || '').trim(), adminId, JSON.stringify(structuredData), image_url || '', image_public_id || '']
    );
    logger.info({ opportunityId: id, submitter: submitter_email || 'anonymous' }, 'Public opportunity submitted');
    return res.status(201).json({ success: true, message: 'Your opportunity has been submitted for review.' });
  }

  // Everything below requires admin
  const admin = await requireAdmin(req, res);
  if (!admin) return;

  if (action === 'create') {
    const parsed = parseWith(opportunitySchema, body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error, details: parsed.details });
    const { title, description, link, image_url, image_public_id, image_crop, image_size, category, deadline, status, publish_at } = parsed.data;
    const id = uuidv4();
    const finalStatus = status === 'draft' ? 'draft' : (publish_at ? 'draft' : 'active');
    await query(
      `INSERT INTO opportunities (id, title, description, link, image_url, image_public_id, image_crop, image_size, category, deadline, status, created_by, created_date, updated_date, publish_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now(),$13)`,
      [id, title, description || '', link || '', image_url || '', image_public_id || '', image_crop ? JSON.stringify(image_crop) : null, image_size || 'medium', category || '', deadline || '', finalStatus, admin.id, publish_at || null]
    );
    await logAudit({ userId: admin.id, action: 'create', entityType: 'opportunity', entityId: id, ipAddress: req.headers?.['x-forwarded-for'] || '' });
    logger.info({ opportunityId: id, status: finalStatus }, 'Opportunity created');
    if (finalStatus === 'active') {
      const oppData = { id, title, description, image_url, category, deadline };
      notifyNewOpportunity(oppData).then(results => {
        if (results?.sent > 0) logger.info({ opportunityId: id, sent: results.sent }, 'Instant notification sent to subscribers');
      }).catch(err => logger.error({ opportunityId: id, err: err.message }, 'Instant notification failed'));
      publishToSocial(title, description || '', `${process.env.SITE_URL || 'https://bridgecollectiveopport.org'}/opportunities/${id}`, image_url || '').then(results => {
        logger.info({ opportunityId: id, results }, 'Social publishing results');
      }).catch(err => logger.error({ opportunityId: id, err: err.message }, 'Social publishing failed'));
    }
    invalidateListCache();
    return res.status(201).json({ id, success: true, status: finalStatus });
  }

  if (action === 'update') {
    const { id, title, description, link, image_url, image_public_id, image_crop, image_size, category, deadline, status, trending, featured_order } = body;
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
    if (image_crop !== undefined) {
      sets.push(`image_crop = $${idx++}`);
      params.push(image_crop ? JSON.stringify(image_crop) : null);
    }
    if ('featured_order' in body) {
      sets.push(`featured_order = $${idx++}`);
      params.push(featured_order ?? null);
    }
    if (!sets.length) throw new AppError(400, 'No fields to update');
    sets.push('updated_date = now()');
    params.push(id);
    const result = await query(
      `UPDATE opportunities SET ${sets.join(', ')} WHERE id = $${idx}`,
      params
    );
    if (!result.rowCount) throw new AppError(404, 'Opportunity not found');
    await logAudit({ userId: admin.id, action: 'update', entityType: 'opportunity', entityId: id, metadata: { fields: Object.keys(body) }, ipAddress: req.headers?.['x-forwarded-for'] || '' });
    invalidateListCache();
    logger.info({ opportunityId: id }, 'Opportunity updated');
    return res.json({ success: true });
  }

  if (action === 'delete') {
    const result = await query('DELETE FROM opportunities WHERE id = $1', [body.id]);
    if (!result.rowCount) throw new AppError(404, 'Opportunity not found');
    await logAudit({ userId: admin.id, action: 'delete', entityType: 'opportunity', entityId: body.id, ipAddress: req.headers?.['x-forwarded-for'] || '' });
    invalidateListCache();
    return res.json({ success: true });
  }

  if (action === 'bulk-delete') {
    const { ids } = body;
    if (!Array.isArray(ids) || !ids.length) throw new AppError(400, 'ids array is required');
    const result = await query('DELETE FROM opportunities WHERE id = ANY($1::uuid[])', [ids]);
    await logAudit({ userId: admin.id, action: 'bulk_delete', entityType: 'opportunity', metadata: { count: ids.length }, ipAddress: req.headers?.['x-forwarded-for'] || '' });
    invalidateListCache();
    return res.json({ success: true, deleted: result.rowCount });
  }

  if (action === 'bulk-update') {
    const { ids, data } = body;
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
    const result = await query(`UPDATE opportunities SET ${sets.join(', ')} WHERE id = ANY($1::uuid[])`, params);
    invalidateListCache();
    return res.json({ success: true, updated: result.rowCount });
  }

  if (action === 'duplicate') {
    const result = await query('SELECT * FROM opportunities WHERE id = $1', [body.id]);
    if (!result.rows.length) throw new AppError(404, 'Opportunity not found');
    const opp = result.rows[0];
    const newId = uuidv4();
    await query(
      `INSERT INTO opportunities (id, title, description, link, image_url, image_public_id, image_crop, image_size, category, deadline, status, created_by, created_date, updated_date, structured_data, publish_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11,now(),now(),$12,$13)`,
      [newId, opp.title + ' (Copy)', opp.description, opp.link, opp.image_url, opp.image_public_id, opp.image_crop, opp.image_size, opp.category, opp.deadline, admin.id, opp.structured_data || '{}', null]
    );
    await logAudit({ userId: admin.id, action: 'duplicate', entityType: 'opportunity', entityId: newId, ipAddress: req.headers?.['x-forwarded-for'] || '' });
    return res.status(201).json({ id: newId, success: true });
  }

  if (action === 'bulk-publish') {
    const { ids } = body;
    if (!Array.isArray(ids) || !ids.length) throw new AppError(400, 'ids array is required');
    const draftResult = await query("SELECT * FROM scraped_posts WHERE id = ANY($1::uuid[]) AND status = 'draft'", [ids]);
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
      await query(
        `INSERT INTO opportunities (id, title, description, link, image_url, category, deadline, status, created_by, created_date, updated_date, structured_data)
         VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,now(),now(),$9)`,
        [oppId, title, description, applyUrl, imageUrl, category, deadline, admin.id, JSON.stringify(structuredData)]
      );
      await query(
        `UPDATE scraped_posts SET rewritten_title = $1, rewritten_description = $2, opportunity_id = $3, posted_to_website = true, posted_date = now(), status = 'published'
         WHERE id = $4`,
        [title, description, oppId, d.id]
      );
      notifyNewOpportunity({ id: oppId, title, description, image_url: imageUrl, category, deadline }).catch(err => {
        logger.error({ opportunityId: oppId, err: err.message }, 'Bulk publish notification failed');
      });
      published++;
    }
    await logAudit({ userId: admin.id, action: 'bulk_publish', entityType: 'scraped_posts', metadata: { count: published }, ipAddress: req.headers?.['x-forwarded-for'] || '' });
    return res.json({ success: true, published });
  }

  if (action === 'clone-from-url') {
    const { url } = body;
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

    // AI extraction is disabled on this backend — return the basic metadata
    return res.json({
      title: extractedTitle,
      description: extractedDesc,
      category: 'Scholarship',
      deadline: '',
      link: url,
      organization: '',
      location: '',
      funding: '',
    });
  }

  if (action === 'enrich') {
    return res.status(501).json({ error: 'AI enrichment is disabled on the Nhost free-tier backend. See MIGRATION.md.' });
  }

  throw new AppError(404, `Unknown opportunity action: ${action}`);
}

async function handleCategoryAction(body, req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const action = body.action;

  if (action === 'create') {
    const parsed = parseWith(categorySchema, body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error, details: parsed.details });
    const { name, description, icon, color, accent, accent_bg } = parsed.data;
    const existing = await query('SELECT id FROM categories WHERE name = $1', [name]);
    if (existing.rows.length) throw new AppError(409, 'Category already exists');
    const result = await query(
      'INSERT INTO categories (name, description, icon, color, accent, accent_bg) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, description || '', icon || 'Briefcase', color || 'text-blue-600 bg-blue-100', accent || 'bg-blue-500', accent_bg || 'bg-blue-50']
    );
    await cache.del('cats:list');
    await logAudit({ userId: admin.id, action: 'create', entityType: 'category', entityId: result.rows[0].id, ipAddress: req.headers?.['x-forwarded-for'] || '' });
    logger.info({ categoryId: result.rows[0].id, name }, 'Category created');
    return res.status(201).json(result.rows[0]);
  }

  if (action === 'update') {
    const parsed = parseWith(categorySchema, body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error, details: parsed.details });
    const { name, description, icon, color, accent, accent_bg } = parsed.data;
    const result = await query(
      'UPDATE categories SET name = COALESCE($1, name), description = COALESCE($2, description), icon = COALESCE($3, icon), color = COALESCE($4, color), accent = COALESCE($5, accent), accent_bg = COALESCE($6, accent_bg), updated_date = now() WHERE id = $7 RETURNING *',
      [name, description, icon, color, accent, accent_bg, body.id]
    );
    if (!result.rows.length) throw new AppError(404, 'Category not found');
    await cache.del('cats:list');
    await logAudit({ userId: admin.id, action: 'update', entityType: 'category', entityId: body.id, ipAddress: req.headers?.['x-forwarded-for'] || '' });
    return res.json(result.rows[0]);
  }

  if (action === 'delete') {
    await query("UPDATE opportunities SET category = '' WHERE category = (SELECT name FROM categories WHERE id = $1)", [body.id]);
    const result = await query('DELETE FROM categories WHERE id = $1', [body.id]);
    if (!result.rowCount) throw new AppError(404, 'Category not found');
    await cache.del('cats:list');
    await cache.del('opps:list');
    await logAudit({ userId: admin.id, action: 'delete', entityType: 'category', entityId: body.id, ipAddress: req.headers?.['x-forwarded-for'] || '' });
    return res.json({ success: true });
  }

  throw new AppError(404, `Unknown category action: ${action}`);
}

async function handleNewsAction(body, req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const action = body.action;

  if (action === 'create') {
    const { title, content, image_url, link, published_date } = body;
    if (!title) throw new AppError(400, 'Title is required');
    const result = await query(
      'INSERT INTO news (title, content, image_url, link, published_date) VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz, now())) RETURNING *',
      [title, content || '', image_url || '', link || '', published_date || null]
    );
    logger.info({ newsId: result.rows[0].id, title }, 'News created');
    return res.status(201).json(result.rows[0]);
  }

  if (action === 'update') {
    const { id, title, content, image_url, link, published_date } = body;
    const result = await query(
      `UPDATE news SET title = COALESCE($1, title), content = COALESCE($2, content), image_url = COALESCE($3, image_url),
       link = COALESCE($4, link), published_date = COALESCE($5::timestamptz, published_date), updated_at = now()
       WHERE id = $6 RETURNING *`,
      [title, content, image_url, link, published_date || null, id]
    );
    if (!result.rows.length) throw new AppError(404, 'News not found');
    logger.info({ newsId: id }, 'News updated');
    return res.json(result.rows[0]);
  }

  if (action === 'delete') {
    const result = await query('DELETE FROM news WHERE id = $1', [body.id]);
    if (!result.rowCount) throw new AppError(404, 'News not found');
    logger.info({ newsId: body.id }, 'News deleted');
    return res.json({ success: true });
  }

  throw new AppError(404, `Unknown news action: ${action}`);
}

export default handle(async (req, res) => {
  if (req.method === 'GET') return handleGet(req, res);

  if (req.method === 'POST') {
    const body = req.body || {};
    const resource = body.resource;

    if (resource === 'opportunity') return handleOpportunityAction(body, null, req, res);
    if (resource === 'category') return handleCategoryAction(body, req, res);
    if (resource === 'news') return handleNewsAction(body, req, res);
    throw new AppError(404, `Unknown resource: ${resource}`);
  }

  res.status(405).json({ error: 'Method not allowed' });
});
