import { getPool, setCORS, readBody, parseQuery } from './_db.js';
import { notifyNewOpportunities } from './_email.js';
import { requireAuth, requireAdmin } from './_auth.js';

const NOT_EXPIRED = `(deadline = '' OR deadline IS NULL OR deadline !~ '^\\d{4}-\\d{2}-\\d{2}$' OR TO_DATE(deadline, 'YYYY-MM-DD') >= CURRENT_DATE)`;
const OPP_LIST_COLS = 'id, title, category, deadline, description, image_url, image_crop, image_size, image_public_id, trending, featured_order, created_date, updated_date, link, status';

/* ---------------------------------- GET ---------------------------------- */

async function handleGet(params) {
  const pool = getPool();
  const resource = params.resource;

  if (resource === 'home') {
    const sql = `
      WITH featured AS (
        SELECT ${OPP_LIST_COLS} FROM opportunities WHERE status = 'active' AND ${NOT_EXPIRED} AND featured_order IS NOT NULL ORDER BY featured_order ASC
      ),
      opps AS (
        SELECT ${OPP_LIST_COLS} FROM opportunities WHERE status = 'active' AND ${NOT_EXPIRED} ORDER BY created_date DESC
      ),
      cats AS (
        SELECT * FROM categories ORDER BY name ASC
      ),
      expiring AS (
        SELECT ${OPP_LIST_COLS} FROM opportunities WHERE status = 'active' AND ${NOT_EXPIRED} AND deadline != '' AND deadline IS NOT NULL
          AND TO_DATE(deadline, 'YYYY-MM-DD') >= CURRENT_DATE AND TO_DATE(deadline, 'YYYY-MM-DD') <= CURRENT_DATE + interval '7 days'
        ORDER BY TO_DATE(deadline, 'YYYY-MM-DD') ASC
      ),
      lists AS (
        SELECT id, name, slug, description, sort_order FROM lists ORDER BY sort_order ASC, created_date DESC
      ),
      items AS (
        SELECT li.list_id, li.sort_order AS list_sort_order, o.id, o.title, o.category, o.deadline, o.description, o.image_url, o.image_crop, o.image_size, o.image_public_id, o.trending, o.created_date, o.updated_date
        FROM list_items li JOIN opportunities o ON o.id = li.opportunity_id
        WHERE li.list_id IN (SELECT id FROM lists) AND o.status = 'active' AND ${NOT_EXPIRED}
      )
      SELECT json_build_object(
        'featured', (SELECT COALESCE(json_agg(row_to_json(f)), '[]'::json) FROM featured f),
        'opportunities', (SELECT COALESCE(json_agg(row_to_json(o)), '[]'::json) FROM opps o),
        'categories', (SELECT COALESCE(json_agg(row_to_json(c)), '[]'::json) FROM cats c),
        'expiringSoon', (SELECT COALESCE(json_agg(row_to_json(e)), '[]'::json) FROM expiring e),
        'curatedLists', (SELECT COALESCE(json_agg(json_build_object(
            'id', l.id, 'name', l.name, 'slug', l.slug, 'description', l.description, 'sort_order', l.sort_order,
            'items', (SELECT COALESCE(json_agg(row_to_json(i) ORDER BY i.list_sort_order ASC, i.created_date DESC), '[]'::json) FROM items i WHERE i.list_id = l.id)
        )), '[]'::json) FROM lists l)
      ) AS payload`;
    const result = await pool.query(sql);
    return result.rows[0].payload;
  }

  if (resource === 'opportunities') {
    const { category, search, trending, featured, all, expiring_soon, expiring_within } = params;
    let sql = `SELECT ${all === 'true' ? '*' : OPP_LIST_COLS} FROM opportunities`;
    const conditions = [];
    const query_params = [];
    let idx = 1;
    if (all !== 'true') {
      conditions.push(`status = $${idx++}`);
      query_params.push('active');
    }
    conditions.push(`${NOT_EXPIRED}`);
    if (category) {
      conditions.push(`category = $${idx++}`);
      query_params.push(category);
    }
    if (search) {
      conditions.push(`(title ILIKE $${idx} OR description ILIKE $${idx})`);
      query_params.push(`%${search}%`);
      idx++;
    }
    if (trending === 'true') conditions.push('trending = true');
    if (featured === 'true') conditions.push('featured_order IS NOT NULL');
    if (expiring_soon === 'true') {
      let days = Math.max(1, parseInt(expiring_within, 10) || 7);
      if (days > 365) days = 365;
      conditions.push(`deadline != '' AND deadline IS NOT NULL`);
      conditions.push(`TO_DATE(deadline, 'YYYY-MM-DD') >= CURRENT_DATE`);
      conditions.push(`TO_DATE(deadline, 'YYYY-MM-DD') <= CURRENT_DATE + $${idx++}::interval`);
      query_params.push(`${days} days`);
    }
    if (conditions.length) sql += ' WHERE ' + conditions.join(' AND ');
    if (featured === 'true') sql += ' ORDER BY featured_order ASC';
    else if (expiring_soon === 'true') sql += " ORDER BY TO_DATE(deadline, 'YYYY-MM-DD') ASC";
    else sql += ' ORDER BY created_date DESC';
    const result = await pool.query(sql, query_params);
    return result.rows;
  }

  if (resource === 'opportunity') {
    const result = await pool.query('SELECT * FROM opportunities WHERE id = $1', [params.id]);
    if (!result.rows.length) throw new Error('Opportunity not found');
    return result.rows[0];
  }

  if (resource === 'check-duplicates') {
    const { title, link, exclude } = params;
    if (!title && !link) return { duplicates: [] };
    const conditions = [];
    const query_params = [];
    let idx = 1;
    if (title) {
      conditions.push(`(title ILIKE $${idx} OR position(lower($${idx}) in lower(title)) > 0)`);
      query_params.push(`%${title}%`);
      idx++;
    }
    if (link) {
      conditions.push(`(link = $${idx} OR (link IS NOT NULL AND link != '' AND $${idx} != '' AND (link = $${idx} OR position($${idx} in link) > 0 OR position(link in $${idx}) > 0)))`);
      query_params.push(link);
      idx++;
    }
    let excludeIdx = null;
    if (exclude) {
      excludeIdx = idx;
      query_params.push(exclude);
      idx++;
    }
    let where = `(${conditions.join(' OR ')})`;
    if (excludeIdx) where += ` AND id != $${excludeIdx}`;
    const result = await pool.query(
      `SELECT id, title, link, category, deadline, status, created_date FROM opportunities WHERE ${where} ORDER BY created_date DESC LIMIT 5`,
      query_params
    );
    return { duplicates: result.rows };
  }

  if (resource === 'categories') {
    const result = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    return result.rows;
  }

  if (resource === 'category') {
    const result = await pool.query('SELECT * FROM categories WHERE id = $1', [params.id]);
    if (!result.rows.length) throw new Error('Category not found');
    return result.rows[0];
  }

  if (resource === 'news') {
    const limit = Math.min(parseInt(params.limit, 10) || 50, 200);
    const result = await pool.query('SELECT * FROM news ORDER BY published_date DESC LIMIT $1', [limit]);
    return result.rows;
  }

  if (resource === 'news-item') {
    const result = await pool.query('SELECT * FROM news WHERE id = $1', [params.id]);
    if (!result.rows.length) throw new Error('News not found');
    return result.rows[0];
  }

  if (resource === 'related') {
    const opp = await pool.query('SELECT category, id FROM opportunities WHERE id = $1', [params.id]);
    if (!opp.rows.length) return [];
    const { category, id } = opp.rows[0];
    const result = await pool.query(
      `SELECT id, title, image_url, category, deadline, created_date FROM opportunities WHERE category = $1 AND id != $2 AND status = 'active' AND ${NOT_EXPIRED} ORDER BY created_date DESC LIMIT 4`,
      [category, id]
    );
    return result.rows;
  }

  if (resource === 'unsubscribe') {
    const { email, id } = params;
    if (!email) throw new Error('Email is required');
    await pool.query(
      "UPDATE subscribers SET is_active = false WHERE email = $1 AND ($2::uuid IS NULL OR id = $2::uuid)",
      [email, id || null]
    );
    return { success: true, message: 'Unsubscribed' };
  }

  throw new Error(`Unknown resource: ${resource}`);
}

/* ---------------------------------- POST ---------------------------------- */

async function handlePost(body, req) {
  const pool = getPool();
  const resource = body.resource;

  if (resource === 'opportunity') return handleOpportunityAction(body, req, pool);
  if (resource === 'category') return handleCategoryAction(body, req, pool);
  if (resource === 'news') return handleNewsAction(body, req, pool);

  throw new Error(`Unknown resource: ${resource}`);
}

async function handleOpportunityAction(body, req, pool) {
  const action = body.action;

  // Public endpoint — the "Submit Opportunity" form is not gated behind auth,
  // so this must be handled before requireAdmin().
  if (action === 'submit') {
    const { title, description, link, category, deadline, submitter_name, submitter_email, image_url, image_public_id } = body;
    if (!title || !title.trim()) throw new Error('Title is required');
    const id = crypto.randomUUID();
    const structuredData = { submitted_by: submitter_name || 'Anonymous', submitter_email: submitter_email || '', submitted_at: new Date().toISOString(), type: 'user_submission' };
    const adminResult = await pool.query("SELECT id FROM users WHERE role = 'admin' ORDER BY created_date ASC LIMIT 1");
    const adminId = adminResult.rows[0]?.id;
    if (!adminId) throw new Error('No admin configured');
    await pool.query(
      `INSERT INTO opportunities (id, title, description, link, category, deadline, status, created_by, created_date, updated_date, structured_data, image_url, image_public_id)
       VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, now(), now(), $8, $9, $10)`,
      [id, title.trim(), (description || '').trim(), (link || '').trim(), (category || '').trim(), (deadline || '').trim(), adminId, JSON.stringify(structuredData), image_url || '', image_public_id || '']
    );
    return { success: true, message: 'Your opportunity has been submitted for review.' };
  }

  // Everything below here is admin-only.
  const admin = await requireAdmin(req);

  if (action === 'create') {
    const { title, description, link, image_url, image_public_id, image_crop, image_size, category, deadline, status, publish_at } = body;
    const id = crypto.randomUUID();
    const finalStatus = status === 'draft' ? 'draft' : (publish_at ? 'draft' : 'active');
    await pool.query(
      `INSERT INTO opportunities (id, title, description, link, image_url, image_public_id, image_crop, image_size, category, deadline, status, created_by, created_date, updated_date, publish_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,$11,$12,now(),now(),$13)`,
      [id, title, description || '', link || '', image_url || '', image_public_id || '', image_crop ? JSON.stringify(image_crop) : null, image_size || 'medium', category || '', deadline || '', finalStatus, admin.id, publish_at || null]
    );
    // Notify subscribers immediately, but only for opportunities going live now.
    // Awaited on purpose: a fire-and-forget promise can be frozen mid-send by the
    // serverless runtime once the response is returned.
    const notification = finalStatus === 'active'
      ? await notifyNewOpportunities([{ id, title, description, image_url, category, deadline }])
      : null;
    return { id, success: true, status: finalStatus, notification };
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
    if (!sets.length) throw new Error('No fields to update');
    // Only look up the previous state when this update may publish the post.
    let wasActive = true;
    if (status === 'active') {
      const before = await pool.query('SELECT status FROM opportunities WHERE id = $1', [id]);
      wasActive = before.rows[0]?.status === 'active';
    }
    sets.push('updated_date = now()');
    params.push(id);
    const result = await pool.query(
      `UPDATE opportunities SET ${sets.join(', ')} WHERE id = $${idx} RETURNING id, title, description, image_url, category, deadline`,
      params
    );
    if (!result.rowCount) throw new Error('Opportunity not found');
    // "Approve & Publish" on a draft/pending post is a first publish, so it notifies.
    const notification = !wasActive && status === 'active'
      ? await notifyNewOpportunities([result.rows[0]])
      : null;
    return { success: true, notification };
  }

  if (action === 'delete') {
    const result = await pool.query('DELETE FROM opportunities WHERE id = $1', [body.id]);
    if (!result.rowCount) throw new Error('Opportunity not found');
    return { success: true };
  }

  if (action === 'bulk-delete') {
    const { ids } = body;
    if (!Array.isArray(ids) || !ids.length) throw new Error('ids array is required');
    const result = await pool.query('DELETE FROM opportunities WHERE id = ANY($1::uuid[])', [ids]);
    return { success: true, deleted: result.rowCount };
  }

  if (action === 'bulk-update') {
    const { ids, data } = body;
    if (!Array.isArray(ids) || !ids.length) throw new Error('ids array is required');
    if (!data || typeof data !== 'object') throw new Error('data object is required');
    const sets = [];
    const params = [ids];
    let idx = 2;
    for (const [key, value] of Object.entries(data)) {
      if (['title', 'description', 'status', 'category', 'trending', 'featured_order', 'deadline'].includes(key)) {
        sets.push(`${key} = $${idx++}`);
        params.push(value);
      }
    }
    if (!sets.length) throw new Error('No valid fields to update');
    // Setting status=active in bulk is another way to publish, so find the rows
    // that are not live yet and notify about those only.
    let publishingIds = [];
    if (data.status === 'active') {
      const before = await pool.query(
        "SELECT id FROM opportunities WHERE id = ANY($1::uuid[]) AND status != 'active'",
        [ids]
      );
      publishingIds = before.rows.map(r => r.id);
    }
    sets.push('updated_date = now()');
    const result = await pool.query(`UPDATE opportunities SET ${sets.join(', ')} WHERE id = ANY($1::uuid[])`, params);
    let notification = null;
    if (publishingIds.length) {
      const published = await pool.query(
        'SELECT id, title, description, image_url, category, deadline FROM opportunities WHERE id = ANY($1::uuid[])',
        [publishingIds]
      );
      notification = await notifyNewOpportunities(published.rows);
    }
    return { success: true, updated: result.rowCount, notification };
  }

  if (action === 'bulk-publish') {
    const { ids } = body;
    if (!Array.isArray(ids) || !ids.length) throw new Error('ids array is required');
    const result = await pool.query(
      `UPDATE opportunities SET status = 'active', updated_date = now()
       WHERE id = ANY($1::uuid[]) AND status != 'active'
       RETURNING id, title, description, image_url, category, deadline`,
      [ids]
    );
    // One combined email for the whole batch so publishing 20 drafts doesn't
    // send 20 separate emails.
    const notification = result.rows.length ? await notifyNewOpportunities(result.rows) : null;
    return { success: true, published: result.rows.length, notification };
  }

  if (action === 'duplicate') {
    const result = await pool.query('SELECT * FROM opportunities WHERE id = $1', [body.id]);
    if (!result.rows.length) throw new Error('Opportunity not found');
    const opp = result.rows[0];
    const newId = crypto.randomUUID();
    await pool.query(
      `INSERT INTO opportunities (id, title, description, link, image_url, image_public_id, image_crop, image_size, category, deadline, status, created_by, created_date, updated_date, structured_data, publish_at)
       VALUES ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,'draft',$11,now(),now(),$12,$13)`,
      [newId, opp.title + ' (Copy)', opp.description, opp.link, opp.image_url, opp.image_public_id, opp.image_crop, opp.image_size, opp.category, opp.deadline, admin.id, opp.structured_data || '{}', null]
    );
    return { id: newId, success: true };
  }

  if (action === 'clone-from-url') {
    const { url } = body;
    if (!url) throw new Error('URL is required');
    const response = await fetch(url, { headers: { 'User-Agent': 'BridgeJobs/1.0' }, signal: AbortSignal.timeout(15000) });
    if (!response.ok) throw new Error(`Failed to fetch URL: ${response.status}`);
    const html = await response.text();
    const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
    const descMatch = html.match(/<meta[^>]+name="description"[^>]+content="([^"]+)"/i);
    return {
      title: (titleMatch?.[1] || '').trim(),
      description: (descMatch?.[1] || '').trim(),
      category: 'Scholarship',
      deadline: '',
      link: url,
      organization: '',
      location: '',
      funding: '',
    };
  }

  throw new Error(`Unknown opportunity action: ${action}`);
}

async function handleCategoryAction(body, req, pool) {
  const admin = await requireAdmin(req);
  if (!admin) throw new Error('Admin access required');
  const action = body.action;

  if (action === 'create') {
    const { name, description, icon, color, accent, accent_bg } = body;
    if (!name) throw new Error('Name is required');
    const existing = await pool.query('SELECT id FROM categories WHERE name = $1', [name]);
    if (existing.rows.length) throw new Error('Category already exists');
    const result = await pool.query(
      'INSERT INTO categories (name, description, icon, color, accent, accent_bg) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, description || '', icon || 'Briefcase', color || 'text-blue-600 bg-blue-100', accent || 'bg-blue-500', accent_bg || 'bg-blue-50']
    );
    return result.rows[0];
  }

  if (action === 'update') {
    const { id, name, description, icon, color, accent, accent_bg } = body;
    const result = await pool.query(
      'UPDATE categories SET name = COALESCE($1, name), description = COALESCE($2, description), icon = COALESCE($3, icon), color = COALESCE($4, color), accent = COALESCE($5, accent), accent_bg = COALESCE($6, accent_bg), updated_date = now() WHERE id = $7 RETURNING *',
      [name, description, icon, color, accent, accent_bg, id]
    );
    if (!result.rows.length) throw new Error('Category not found');
    return result.rows[0];
  }

  if (action === 'delete') {
    await pool.query("UPDATE opportunities SET category = '' WHERE category = (SELECT name FROM categories WHERE id = $1)", [body.id]);
    const result = await pool.query('DELETE FROM categories WHERE id = $1', [body.id]);
    if (!result.rowCount) throw new Error('Category not found');
    return { success: true };
  }

  throw new Error(`Unknown category action: ${action}`);
}

async function handleNewsAction(body, req, pool) {
  const admin = await requireAdmin(req);
  if (!admin) throw new Error('Admin access required');
  const action = body.action;

  if (action === 'create') {
    const { title, content, image_url, link, published_date } = body;
    if (!title || !title.trim()) throw new Error('Title is required');
    const result = await pool.query(
      'INSERT INTO news (title, content, image_url, link, published_date) VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz, now())) RETURNING *',
      [title.trim(), content || '', image_url || '', link || '', published_date || null]
    );
    return result.rows[0];
  }

  if (action === 'update') {
    const { id, title, content, image_url, link, published_date } = body;
    const result = await pool.query(
      `UPDATE news SET title = COALESCE($1, title), content = COALESCE($2, content), image_url = COALESCE($3, image_url),
       link = COALESCE($4, link), published_date = COALESCE($5::timestamptz, published_date), updated_at = now()
       WHERE id = $6 RETURNING *`,
      [title, content, image_url, link, published_date || null, id]
    );
    if (!result.rows.length) throw new Error('News not found');
    return result.rows[0];
  }

  if (action === 'delete') {
    const result = await pool.query('DELETE FROM news WHERE id = $1', [body.id]);
    if (!result.rowCount) throw new Error('News not found');
    return { success: true };
  }

  throw new Error(`Unknown news action: ${action}`);
}

export default async function handler(req, res) {
  setCORS(res);

  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const params = parseQuery(req);

    if (req.method === 'GET') {
      const data = await handleGet(params);
      res.status(200).json(data);
      return;
    }

    if (req.method === 'POST') {
      const body = await readBody(req);
      const data = await handlePost(body, req);
      res.status(200).json(data);
      return;
    }

    res.status(405).json({ error: 'Method not allowed' });
  } catch (error) {
    console.error('Content API error:', error);
    if (error.name === 'AuthError') {
      res.status(error.status || 401).json({ error: error.message });
      return;
    }
    const status = error.message.includes('not found') ? 404 : 500;
    res.status(status).json({ error: error.message });
  }
}
