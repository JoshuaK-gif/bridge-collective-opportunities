/**
 * /v1/collections — lists + templates.
 *
 * GET  /v1/collections?resource=lists
 * GET  /v1/collections?resource=list&id=
 * GET  /v1/collections?resource=list-by-slug&slug=
 * GET  /v1/collections?resource=templates
 * GET  /v1/collections?resource=template&id=
 *
 * POST /v1/collections  { resource: 'list', action: 'create'|'update'|'delete'|'add-item'|'remove-item'|'reorder-item', ... }
 * POST /v1/collections  { resource: 'template', action: 'create'|'update'|'delete', ... }
 */
import { v4 as uuidv4 } from 'uuid';
import { query } from '../_shared/db.js';
import logger from '../_shared/logger.js';
import { requireAdmin } from '../_shared/auth.js';
import { AppError, handle } from '../_shared/errors.js';
import { parseWith, listSchema, listItemSchema } from '../_shared/validate.js';
import { logAudit } from '../_shared/audit.js';

function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 24; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

/* ---------------------------------- GET ---------------------------------- */

async function handleGet(req, res) {
  const q = req.query || {};
  const resource = q.resource;

  if (resource === 'lists') {
    const result = await query('SELECT * FROM lists ORDER BY sort_order ASC, created_date DESC');
    return res.json(result.rows);
  }

  if (resource === 'list' || resource === 'list-by-slug') {
    const listResult = resource === 'list-by-slug'
      ? await query('SELECT * FROM lists WHERE slug = $1', [q.slug])
      : await query('SELECT * FROM lists WHERE id = $1', [q.id]);
    if (!listResult.rows.length) throw new AppError(404, 'List not found');
    const list = listResult.rows[0];
    const itemsResult = await query(
      `SELECT o.*, li.id AS list_item_id, li.sort_order AS list_sort_order
       FROM list_items li
       JOIN opportunities o ON o.id = li.opportunity_id
       WHERE li.list_id = $1
       ORDER BY li.sort_order ASC, o.created_date DESC`,
      [list.id]
    );
    list.items = itemsResult.rows;
    return res.json(list);
  }

  if (resource === 'templates') {
    const result = await query('SELECT * FROM templates ORDER BY updated_date DESC');
    return res.json(result.rows);
  }

  if (resource === 'template') {
    const result = await query('SELECT * FROM templates WHERE id = $1', [q.id]);
    if (!result.rows.length) throw new AppError(404, 'Template not found');
    return res.json(result.rows[0]);
  }

  throw new AppError(404, `Unknown resource: ${resource}`);
}

/* ---------------------------------- POST ---------------------------------- */

async function handleListAction(body, req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const action = body.action;

  if (action === 'create') {
    const parsed = parseWith(listSchema, body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error, details: parsed.details });
    const { name, description } = parsed.data;

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60) || 'list';

    let finalSlug = slug;
    let slugIdx = 1;
    while (true) {
      const existing = await query('SELECT id FROM lists WHERE slug = $1', [finalSlug]);
      if (!existing.rows.length) break;
      finalSlug = `${slug}-${slugIdx++}`;
    }

    const id = uuidv4();
    await query('INSERT INTO lists (id, name, slug, description) VALUES ($1, $2, $3, $4)', [id, name, finalSlug, description || '']);
    await logAudit({ userId: admin.id, action: 'create', entityType: 'list', entityId: id, ipAddress: req.headers?.['x-forwarded-for'] || '' });
    logger.info({ listId: id, name }, 'List created');
    return res.status(201).json({ id, slug: finalSlug, success: true });
  }

  if (action === 'update') {
    const { id, name, description, sort_order } = body;
    const safeSortOrder = sort_order !== undefined ? parseInt(sort_order, 10) : undefined;
    const result = await query(
      'UPDATE lists SET name = COALESCE($1, name), description = COALESCE($2, description), sort_order = COALESCE($3, sort_order), updated_date = now() WHERE id = $4 RETURNING *',
      [name, description, isNaN(safeSortOrder) ? undefined : safeSortOrder, id]
    );
    if (!result.rows.length) throw new AppError(404, 'List not found');
    await logAudit({ userId: admin.id, action: 'update', entityType: 'list', entityId: id, ipAddress: req.headers?.['x-forwarded-for'] || '' });
    return res.json(result.rows[0]);
  }

  if (action === 'delete') {
    const result = await query('DELETE FROM lists WHERE id = $1', [body.id]);
    if (!result.rowCount) throw new AppError(404, 'List not found');
    await logAudit({ userId: admin.id, action: 'delete', entityType: 'list', entityId: body.id, ipAddress: req.headers?.['x-forwarded-for'] || '' });
    return res.json({ success: true });
  }

  if (action === 'add-item') {
    const parsed = parseWith(listItemSchema, body);
    if (!parsed.ok) return res.status(400).json({ error: parsed.error, details: parsed.details });
    const { opportunity_id } = parsed.data;
    const listExists = await query('SELECT id FROM lists WHERE id = $1', [body.id]);
    if (!listExists.rows.length) throw new AppError(404, 'List not found');
    const oppExists = await query('SELECT id FROM opportunities WHERE id = $1', [opportunity_id]);
    if (!oppExists.rows.length) throw new AppError(404, 'Opportunity not found');
    const maxOrder = await query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM list_items WHERE list_id = $1',
      [body.id]
    );
    const id = uuidv4();
    await query(
      'INSERT INTO list_items (id, list_id, opportunity_id, sort_order) VALUES ($1, $2, $3, $4) ON CONFLICT (list_id, opportunity_id) DO NOTHING',
      [id, body.id, opportunity_id, maxOrder.rows[0].next_order]
    );
    logger.info({ listId: body.id, opportunityId: opportunity_id }, 'Item added to list');
    return res.status(201).json({ id, success: true });
  }

  if (action === 'remove-item') {
    const { list_id, item_id } = body;
    const result = await query('DELETE FROM list_items WHERE id = $1 AND list_id = $2', [item_id, list_id]);
    if (!result.rowCount) throw new AppError(404, 'Item not found in list');
    logger.info({ listId: list_id, itemId: item_id }, 'Item removed from list');
    return res.json({ success: true });
  }

  if (action === 'reorder-item') {
    const { list_id, item_id, sort_order } = body;
    if (sort_order === undefined) throw new AppError(400, 'sort_order is required');
    const safeOrder = parseInt(sort_order, 10);
    if (isNaN(safeOrder)) throw new AppError(400, 'sort_order must be a number');
    await query('UPDATE list_items SET sort_order = $1 WHERE id = $2 AND list_id = $3', [safeOrder, item_id, list_id]);
    return res.json({ success: true });
  }

  throw new AppError(404, `Unknown list action: ${action}`);
}

async function handleTemplateAction(body, req, res) {
  const admin = await requireAdmin(req, res);
  if (!admin) return;
  const action = body.action;

  if (action === 'create') {
    const { name, category, description, image_url, deadline, link, structured_data } = body;
    if (!name) throw new AppError(400, 'Template name is required');
    const result = await query(
      `INSERT INTO templates (name, category, description, image_url, deadline, link, structured_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [name, category || '', description || '', image_url || '', deadline || '', link || '', JSON.stringify(structured_data || {})]
    );
    logger.info({ templateId: result.rows[0].id, name }, 'Template created');
    return res.status(201).json({ id: result.rows[0].id, success: true });
  }

  if (action === 'update') {
    const { id, name, category, description, image_url, deadline, link, structured_data } = body;
    const sets = [];
    const params = [];
    let idx = 1;
    const fieldMap = { name, category, description, image_url, deadline, link };
    for (const [key, val] of Object.entries(fieldMap)) {
      if (val !== undefined) {
        sets.push(`${key} = $${idx++}`);
        params.push(val);
      }
    }
    if (structured_data !== undefined) {
      sets.push(`structured_data = $${idx++}`);
      params.push(JSON.stringify(structured_data));
    }
    if (!sets.length) throw new AppError(400, 'No fields to update');
    sets.push('updated_date = now()');
    params.push(id);
    await query(`UPDATE templates SET ${sets.join(', ')} WHERE id = $${idx}`, params);
    return res.json({ success: true });
  }

  if (action === 'delete') {
    await query('DELETE FROM templates WHERE id = $1', [body.id]);
    return res.json({ success: true });
  }

  throw new AppError(404, `Unknown template action: ${action}`);
}

export default handle(async (req, res) => {
  if (req.method === 'GET') return handleGet(req, res);

  if (req.method === 'POST') {
    const body = req.body || {};
    const resource = body.resource;

    if (resource === 'list') return handleListAction(body, req, res);
    if (resource === 'template') return handleTemplateAction(body, req, res);
    throw new AppError(404, `Unknown resource: ${resource}`);
  }

  res.status(405).json({ error: 'Method not allowed' });
});
