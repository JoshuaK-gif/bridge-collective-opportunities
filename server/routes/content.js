import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';
import { AppError } from '../lib/errors.js';
import { logAudit } from '../lib/audit.js';
import { notifyNewOpportunity } from '../lib/email.js';
import cache from '../lib/cache.js';

const router = Router();

const OPP_LIST_COLS = 'id, title, category, deadline, description, image_url, image_crop, image_size, image_public_id, trending, featured_order, created_date, updated_date';
const NOT_EXPIRED = `(deadline = '' OR deadline IS NULL OR deadline !~ '^\\d{4}-\\d{2}-\\d{2}$' OR TO_DATE(deadline, 'YYYY-MM-DD') >= CURRENT_DATE)`;

function invalidateListCache() {
  cache.del('opps:list');
  cache.del('opps:featured');
  cache.del('opps:expiring');
  cache.del('cats:list');
}

function isAdmin(req, res, next) {
  authenticate(req, res, (err) => {
    if (err || !req.user) return res.status(401).json({ error: 'Unauthorized' });
    if (req.user.role !== 'admin') return res.status(403).json({ error: 'Forbidden' });
    next();
  });
}

/* ---------------------------------- GET ---------------------------------- */

router.get('/', async (req, res, next) => {
  try {
    const q = req.query;
    const resource = q.resource;

    if (resource === 'opportunities') {
      const { category, search, trending, featured, all, expiring_soon, expiring_within } = q;
      const cacheKey = `opps:${featured === 'true' ? 'featured' : expiring_soon === 'true' ? `expiring:${expiring_within || 7}` : 'list'}`;
      if (!search && all !== 'true' && !category && !trending) {
        const cached = await cache.get(cacheKey);
        if (cached) return res.json(cached);
      }

      let sql = `SELECT ${all === 'true' ? '*' : OPP_LIST_COLS} FROM opportunities`;
      const conditions = [];
      const params = [];
      let idx = 1;
      if (all !== 'true') {
        conditions.push(`status = $${idx++}`);
        params.push('active');
      }
      conditions.push(NOT_EXPIRED);
      if (category) { conditions.push(`category = $${idx++}`); params.push(category); }
      if (search) { conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`); params.push(`%${search}%`); idx++; }
      if (trending === 'true') conditions.push('trending = true');
      if (featured === 'true') conditions.push('featured_order IS NOT NULL');
      if (expiring_soon === 'true') {
        let days = Math.max(1, parseInt(expiring_within, 10) || 7);
        if (days > 365) days = 365;
        conditions.push(`deadline != '' AND deadline IS NOT NULL`);
        conditions.push(`TO_DATE(deadline, 'YYYY-MM-DD') >= CURRENT_DATE`);
        conditions.push(`TO_DATE(deadline, 'YYYY-MM-DD') <= CURRENT_DATE + $${idx++}::interval`);
        params.push(`${days} days`);
      }
      if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
      if (featured === 'true') sql += ' ORDER BY featured_order ASC';
      else if (expiring_soon === 'true') sql += " ORDER BY TO_DATE(deadline, 'YYYY-MM-DD') ASC";
      else sql += ' ORDER BY created_date DESC';

      const result = await pool.query(sql, params);
      if (!search && all !== 'true' && !category && !trending) cache.set(cacheKey, result.rows, 60);
      return res.json(result.rows);
    }

    if (resource === 'home') {
      const sql = `
WITH featured AS (SELECT ${OPP_LIST_COLS} FROM opportunities WHERE status = 'active' AND ${NOT_EXPIRED} AND featured_order IS NOT NULL ORDER BY featured_order ASC),
opps AS (SELECT ${OPP_LIST_COLS} FROM opportunities WHERE status = 'active' AND ${NOT_EXPIRED} ORDER BY created_date DESC),
cats AS (SELECT * FROM categories ORDER BY name ASC),
expiring AS (SELECT ${OPP_LIST_COLS} FROM opportunities WHERE status = 'active' AND ${NOT_EXPIRED} AND deadline != '' AND deadline IS NOT NULL AND TO_DATE(deadline, 'YYYY-MM-DD') >= CURRENT_DATE AND TO_DATE(deadline, 'YYYY-MM-DD') <= CURRENT_DATE + interval '7 days' ORDER BY TO_DATE(deadline, 'YYYY-MM-DD') ASC),
lists AS (SELECT id, name, slug, description, sort_order FROM lists ORDER BY sort_order ASC, created_date DESC),
items AS (SELECT li.list_id, li.sort_order AS list_sort_order, o.id, o.title, o.category, o.deadline, o.description, o.image_url, o.image_crop, o.image_size, o.image_public_id, o.trending, o.created_date, o.updated_date FROM list_items li JOIN opportunities o ON o.id = li.opportunity_id WHERE li.list_id IN (SELECT id FROM lists) AND o.status = 'active' AND ${NOT_EXPIRED})
SELECT json_build_object(
  'featured', (SELECT COALESCE(json_agg(row_to_json(f)), '[]'::json) FROM featured f),
  'opportunities', (SELECT COALESCE(json_agg(row_to_json(o)), '[]'::json) FROM opps o),
  'categories', (SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json) FROM cats c),
  'expiringSoon', (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM expiring e),
  'curatedLists', (SELECT COALESCE(json_agg(json_build_object('id', l.id, 'name', l.name, 'slug', l.slug, 'description', l.description, 'sort_order', l.sort_order, 'items', (SELECT COALESCE(json_agg(row_to_json(i) ORDER BY i.list_sort_order ASC, i.created_date DESC), '[]'::json) FROM items i WHERE i.list_id = l.id))), '[]'::json) FROM lists l)
) AS payload`;
      const result = await pool.query(sql);
      return res.json(result.rows[0].payload);
    }

    if (resource === 'opportunity') {
      const result = await pool.query('SELECT * FROM opportunities WHERE id = $1', [q.id]);
      if (!result.rows.length) throw new AppError(404, 'Opportunity not found');
      return res.json(result.rows[0]);
    }

    if (resource === 'check-duplicates') {
      const { title, link, exclude } = q;
      if (!title && !link) return res.json({ duplicates: [] });
      const conditions = [];
      const params = [];
      let idx = 1;
      if (title) { conditions.push(`title ILIKE $${idx} OR position(lower($${idx}) in lower(title)) > 0`); params.push(`%${title}%`); idx++; }
      if (link) { conditions.push(`link = $${idx} OR link IS NOT NULL AND link != '' AND $${idx} != '' AND (link = $${idx} OR position($${idx} in link) > 0 OR position(link in $${idx}) > 0)`); params.push(link); idx++; }
      if (exclude) { conditions.push(`id != $${idx}`); params.push(exclude); idx++; }
      if (!conditions.length) return res.json({ duplicates: [] });
      const result = await pool.query(`SELECT id, title, link, category, deadline, status, created_date FROM opportunities WHERE (${conditions.join(' OR ')}) ORDER BY created_date DESC LIMIT 5`, params);
      return res.json({ duplicates: result.rows });
    }

    if (resource === 'categories') {
      const cached = await cache.get('cats:list');
      if (cached) return res.json(cached);
      const result = await pool.query('SELECT * FROM categories ORDER BY name ASC');
      cache.set('cats:list', result.rows, 120);
      return res.json(result.rows);
    }

    if (resource === 'category') {
      const result = await pool.query('SELECT * FROM categories WHERE id = $1', [q.id]);
      if (!result.rows.length) throw new AppError(404, 'Category not found');
      return res.json(result.rows[0]);
    }

    if (resource === 'news') {
      const limit = Math.min(parseInt(q.limit, 10) || 50, 200);
      const result = await pool.query('SELECT * FROM news ORDER BY published_date DESC LIMIT $1', [limit]);
      return res.json(result.rows);
    }

    if (resource === 'news-item') {
      const result = await pool.query('SELECT * FROM news WHERE id = $1', [q.id]);
      if (!result.rows.length) throw new AppError(404, 'News not found');
      return res.json(result.rows[0]);
    }

    if (resource === 'related') {
      const opp = await pool.query('SELECT category, id FROM opportunities WHERE id = $1', [q.id]);
      if (!opp.rows.length) return res.json([]);
      const { category, id } = opp.rows[0];
      const result = await pool.query(`SELECT id, title, image_url, category, deadline, created_date FROM opportunities WHERE category = $1 AND id != $2 AND status = 'active' AND ${NOT_EXPIRED} ORDER BY created_date DESC LIMIT 4`, [category, id]);
      return res.json(result.rows);
    }

    throw new AppError(404, `Unknown resource: ${resource}`);
  } catch (err) {
    next(err);
  }
});

/* ---------------------------------- POST ---------------------------------- */

router.post('/', async (req, res, next) => {
  try {
    const body = req.body || {};
    const resource = body.resource;

    if (resource === 'opportunity') {
      const action = body.action;

      if (action === 'submit') {
        const { title, description, link, category, deadline, submitter_name, submitter_email, image_url, image_public_id } = body;
        if (!title || !title.trim()) throw new AppError(400, 'Title is required');
        const id = uuidv4();
        const structuredData = { submitted_by: submitter_name || 'Anonymous', submitter_email: submitter_email || '', submitted_at: new Date().toISOString(), type: 'user_submission' };
        const adminResult = await pool.query("SELECT id FROM users WHERE role = 'admin' ORDER BY created_date ASC LIMIT 1");
        const adminId = adminResult.rows[0]?.id;
        if (!adminId) throw new AppError(500, 'No admin configured');
        await pool.query(
          `INSERT INTO opportunities (id, title, description, link, category, deadline, status, created_by, created_date, updated_date, structured_data, image_url, image_public_id) VALUES ($1,$2,$3,$4,$5,$6,'pending',$7,now(),now(),$8,$9,$10)`,
          [id, title.trim(), (description || '').trim(), (link || '').trim(), (category || '').trim(), (deadline || '').trim(), adminId, JSON.stringify(structuredData), image_url || '', image_public_id || '']
        );
        return res.status(201).json({ success: true, message: 'Your opportunity has been submitted for review.' });
      }

      // Admin actions
      await new Promise((resolve, reject) => {
        authenticate(req, res, (err) => err ? reject(err) : resolve());
      });
      if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');

      if (action === 'create') {
        const { title, description, link, image_url, image_public_id, image_crop, image_size, category, deadline, status, publish_at } = body;
        if (!title) throw new AppError(400, 'Title is required');
        const id = uuidv4();
        const finalStatus = status === 'draft' ? 'draft' : (publish_at ? 'draft' : 'active');
        await pool.query(
          `INSERT INTO opportunities (id, title, description, link, image_url, image_public_id, image_crop, image_size, category, deadline, status, created_by, created_date, updated_date, publish_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now(),$13)`,
          [id, title, description || '', link || '', image_url || '', image_public_id || '', image_crop ? JSON.stringify(image_crop) : null, image_size || 'medium', category || '', deadline || '', finalStatus, req.user.id, publish_at || null]
        );
        logAudit({ userId: req.user.id, action: 'create', entityType: 'opportunity', entityId: id, ipAddress: req.ip });
        if (finalStatus === 'active') {
          notifyNewOpportunity({ id, title, description, image_url, category, deadline }).catch(err => logger.error(err.message));
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
          if (val !== undefined) { sets.push(`${key} = $${idx++}`); params.push(val); }
        }
        if (image_crop !== undefined) { sets.push(`image_crop = $${idx++}`); params.push(image_crop ? JSON.stringify(image_crop) : null); }
        if ('featured_order' in body) { sets.push(`featured_order = $${idx++}`); params.push(featured_order ?? null); }
        if (!sets.length) throw new AppError(400, 'No fields to update');
        sets.push('updated_date = now()');
        params.push(id);
        const result = await pool.query(`UPDATE opportunities SET ${sets.join(', ')} WHERE id = $${idx}`, params);
        if (!result.rowCount) throw new AppError(404, 'Opportunity not found');
        logAudit({ userId: req.user.id, action: 'update', entityType: 'opportunity', entityId: id, ipAddress: req.ip });
        invalidateListCache();
        return res.json({ success: true });
      }

      if (action === 'delete') {
        const result = await pool.query('DELETE FROM opportunities WHERE id = $1', [body.id]);
        if (!result.rowCount) throw new AppError(404, 'Opportunity not found');
        logAudit({ userId: req.user.id, action: 'delete', entityType: 'opportunity', entityId: body.id, ipAddress: req.ip });
        invalidateListCache();
        return res.json({ success: true });
      }

      if (action === 'bulk-delete') {
        const { ids } = body;
        if (!Array.isArray(ids) || !ids.length) throw new AppError(400, 'ids array is required');
        const result = await pool.query('DELETE FROM opportunities WHERE id = ANY($1::uuid[])', [ids]);
        logAudit({ userId: req.user.id, action: 'bulk_delete', entityType: 'opportunity', metadata: { count: ids.length }, ipAddress: req.ip });
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
          if (['title', 'description', 'status', 'category', 'trending', 'featured_order', 'deadline'].includes(key)) { sets.push(`${key} = $${idx++}`); params.push(value); }
        }
        if (!sets.length) throw new AppError(400, 'No valid fields to update');
        sets.push('updated_date = now()');
        const result = await pool.query(`UPDATE opportunities SET ${sets.join(', ')} WHERE id = ANY($1::uuid[])`, params);
        invalidateListCache();
        return res.json({ success: true, updated: result.rowCount });
      }

      if (action === 'duplicate') {
        const result = await pool.query('SELECT * FROM opportunities WHERE id = $1', [body.id]);
        if (!result.rows.length) throw new AppError(404, 'Opportunity not found');
        const opp = result.rows[0];
        const newId = uuidv4();
        await pool.query(
          `INSERT INTO opportunities (id, title, description, link, image_url, image_public_id, image_crop, image_size, category, deadline, status, created_by, created_date, updated_date, structured_data, publish_at) VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11,now(),now(),$12,$13)`,
          [newId, opp.title + ' (Copy)', opp.description, opp.link, opp.image_url, opp.image_public_id, opp.image_crop, opp.image_size, opp.category, opp.deadline, req.user.id, opp.structured_data || '{}', null]
        );
        logAudit({ userId: req.user.id, action: 'duplicate', entityType: 'opportunity', entityId: newId, ipAddress: req.ip });
        return res.status(201).json({ id: newId, success: true });
      }

      if (action === 'bulk-publish') {
        const { ids } = body;
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
          await pool.query(
            `INSERT INTO opportunities (id, title, description, link, image_url, category, deadline, status, created_by, created_date, updated_date, structured_data) VALUES ($1,$2,$3,$4,$5,$6,$7,'active',$8,now(),now(),$9)`,
            [oppId, title, description, applyUrl, imageUrl, category, deadline, req.user.id, JSON.stringify(d.structured_data || {})]
          );
          await pool.query(`UPDATE scraped_posts SET opportunity_id = $1, posted_to_website = true, posted_date = now(), status = 'published' WHERE id = $2`, [oppId, d.id]);
          published++;
        }
        return res.json({ success: true, published });
      }

      if (action === 'clone-from-url') {
        const { url } = body;
        if (!url) throw new AppError(400, 'URL is required');
        const response = await fetch(url, { headers: { 'User-Agent': 'BridgeJobs/1.0' }, signal: AbortSignal.timeout(15000) });
        if (!response.ok) throw new AppError(400, `Failed to fetch URL: ${response.status}`);
        const html = await response.text();
        const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
        const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
        return res.json({ title: (titleMatch?.[1] || '').trim(), description: (descMatch?.[1] || '').trim(), category: 'Scholarship', deadline: '', link: url });
      }

      throw new AppError(404, `Unknown opportunity action: ${action}`);
    }

    if (resource === 'category') {
      await new Promise((resolve, reject) => {
        authenticate(req, res, (err) => err ? reject(err) : resolve());
      });
      if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
      const action = body.action;

      if (action === 'create') {
        const { name, description, icon, color, accent, accent_bg } = body;
        if (!name) throw new AppError(400, 'Name is required');
        const existing = await pool.query('SELECT id FROM categories WHERE name = $1', [name]);
        if (existing.rows.length) throw new AppError(409, 'Category already exists');
        const result = await pool.query('INSERT INTO categories (name, description, icon, color, accent, accent_bg) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *', [name, description || '', icon || 'Briefcase', color || 'text-blue-600 bg-blue-100', accent || 'bg-blue-500', accent_bg || 'bg-blue-50']);
        await cache.del('cats:list');
        logAudit({ userId: req.user.id, action: 'create', entityType: 'category', entityId: result.rows[0].id, ipAddress: req.ip });
        return res.status(201).json(result.rows[0]);
      }

      if (action === 'update') {
        const { id, name, description, icon, color, accent, accent_bg } = body;
        const result = await pool.query('UPDATE categories SET name = COALESCE($1, name), description = COALESCE($2, description), icon = COALESCE($3, icon), color = COALESCE($4, color), accent = COALESCE($5, accent), accent_bg = COALESCE($6, accent_bg), updated_date = now() WHERE id = $7 RETURNING *', [name, description, icon, color, accent, accent_bg, id]);
        if (!result.rows.length) throw new AppError(404, 'Category not found');
        await cache.del('cats:list');
        logAudit({ userId: req.user.id, action: 'update', entityType: 'category', entityId: id, ipAddress: req.ip });
        return res.json(result.rows[0]);
      }

      if (action === 'delete') {
        await pool.query("UPDATE opportunities SET category = '' WHERE category = (SELECT name FROM categories WHERE id = $1)", [body.id]);
        const result = await pool.query('DELETE FROM categories WHERE id = $1', [body.id]);
        if (!result.rowCount) throw new AppError(404, 'Category not found');
        await cache.del('cats:list');
        logAudit({ userId: req.user.id, action: 'delete', entityType: 'category', entityId: body.id, ipAddress: req.ip });
        return res.json({ success: true });
      }

      throw new AppError(404, `Unknown category action: ${action}`);
    }

    if (resource === 'news') {
      await new Promise((resolve, reject) => {
        authenticate(req, res, (err) => err ? reject(err) : resolve());
      });
      if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
      const action = body.action;

      if (action === 'create') {
        const { title, content, image_url, link, published_date } = body;
        if (!title) throw new AppError(400, 'Title is required');
        const result = await pool.query('INSERT INTO news (title, content, image_url, link, published_date) VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz, now())) RETURNING *', [title, content || '', image_url || '', link || '', published_date || null]);
        return res.status(201).json(result.rows[0]);
      }

      if (action === 'update') {
        const { id, title, content, image_url, link, published_date } = body;
        const result = await pool.query('UPDATE news SET title = COALESCE($1, title), content = COALESCE($2, content), image_url = COALESCE($3, image_url), link = COALESCE($4, link), published_date = COALESCE($5::timestamptz, published_date), updated_at = now() WHERE id = $6 RETURNING *', [title, content, image_url, link, published_date || null, id]);
        if (!result.rows.length) throw new AppError(404, 'News not found');
        return res.json(result.rows[0]);
      }

      if (action === 'delete') {
        const result = await pool.query('DELETE FROM news WHERE id = $1', [body.id]);
        if (!result.rowCount) throw new AppError(404, 'News not found');
        return res.json({ success: true });
      }

      throw new AppError(404, `Unknown news action: ${action}`);
    }

    throw new AppError(404, `Unknown resource: ${resource}`);
  } catch (err) {
    next(err);
  }
});

export default router;
