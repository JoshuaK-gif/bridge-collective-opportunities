import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';
import { AppError } from '../lib/errors.js';
import { logAudit } from '../lib/audit.js';

const router = Router();

function requireAdmin(req, res) {
  return new Promise((resolve, reject) => {
    authenticate(req, res, (err) => {
      if (err || !req.user) return reject(new AppError(401, 'Unauthorized'));
      if (req.user.role !== 'admin') return reject(new AppError(403, 'Forbidden'));
      resolve(req.user);
    });
  });
}

/* ---------------------------------- GET ---------------------------------- */

router.get('/', async (req, res, next) => {
  try {
    const resource = req.query.resource;

    if (resource === 'lists') {
      const result = await pool.query('SELECT * FROM lists ORDER BY sort_order ASC, created_date DESC');
      return res.json(result.rows);
    }

    if (resource === 'list' || resource === 'list-by-slug') {
      const listResult = resource === 'list-by-slug'
        ? await pool.query('SELECT * FROM lists WHERE slug = $1', [req.query.slug])
        : await pool.query('SELECT * FROM lists WHERE id = $1', [req.query.id]);
      if (!listResult.rows.length) throw new AppError(404, 'List not found');
      const list = listResult.rows[0];
      const itemsResult = await pool.query(
        `SELECT o.*, li.id AS list_item_id, li.sort_order AS list_sort_order
         FROM list_items li JOIN opportunities o ON o.id = li.opportunity_id
         WHERE li.list_id = $1 ORDER BY li.sort_order ASC, o.created_date DESC`,
        [list.id]
      );
      list.items = itemsResult.rows;
      return res.json(list);
    }

    if (resource === 'templates') {
      const result = await pool.query('SELECT * FROM templates ORDER BY updated_date DESC');
      return res.json(result.rows);
    }

    if (resource === 'template') {
      const result = await pool.query('SELECT * FROM templates WHERE id = $1', [req.query.id]);
      if (!result.rows.length) throw new AppError(404, 'Template not found');
      return res.json(result.rows[0]);
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

    if (resource === 'list') {
      const admin = await requireAdmin(req, res);
      const action = body.action;

      if (action === 'create') {
        const { name, description } = body;
        if (!name) throw new AppError(400, 'Name is required');
        const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').substring(0, 60) || 'list';
        let finalSlug = slug;
        let slugIdx = 1;
        while (true) {
          const existing = await pool.query('SELECT id FROM lists WHERE slug = $1', [finalSlug]);
          if (!existing.rows.length) break;
          finalSlug = `${slug}-${slugIdx++}`;
        }
        const id = uuidv4();
        await pool.query('INSERT INTO lists (id, name, slug, description) VALUES ($1, $2, $3, $4)', [id, name, finalSlug, description || '']);
        logAudit({ userId: admin.id, action: 'create', entityType: 'list', entityId: id, ipAddress: req.ip });
        return res.status(201).json({ id, slug: finalSlug, success: true });
      }

      if (action === 'update') {
        const { id, name, description, sort_order } = body;
        const safeSortOrder = sort_order !== undefined ? parseInt(sort_order, 10) : undefined;
        const result = await pool.query('UPDATE lists SET name = COALESCE($1, name), description = COALESCE($2, description), sort_order = COALESCE($3, sort_order), updated_date = now() WHERE id = $4 RETURNING *', [name, description, isNaN(safeSortOrder) ? undefined : safeSortOrder, id]);
        if (!result.rows.length) throw new AppError(404, 'List not found');
        return res.json(result.rows[0]);
      }

      if (action === 'delete') {
        const result = await pool.query('DELETE FROM lists WHERE id = $1', [body.id]);
        if (!result.rowCount) throw new AppError(404, 'List not found');
        return res.json({ success: true });
      }

      if (action === 'add-item') {
        const { id, opportunity_id } = body;
        if (!id || !opportunity_id) throw new AppError(400, 'id and opportunity_id required');
        const maxOrder = await pool.query('SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM list_items WHERE list_id = $1', [id]);
        const itemId = uuidv4();
        await pool.query('INSERT INTO list_items (id, list_id, opportunity_id, sort_order) VALUES ($1, $2, $3, $4) ON CONFLICT (list_id, opportunity_id) DO NOTHING', [itemId, id, opportunity_id, maxOrder.rows[0].next_order]);
        return res.status(201).json({ id: itemId, success: true });
      }

      if (action === 'remove-item') {
        const { list_id, item_id } = body;
        const result = await pool.query('DELETE FROM list_items WHERE id = $1 AND list_id = $2', [item_id, list_id]);
        if (!result.rowCount) throw new AppError(404, 'Item not found');
        return res.json({ success: true });
      }

      if (action === 'reorder-item') {
        const { list_id, item_id, sort_order } = body;
        if (sort_order === undefined) throw new AppError(400, 'sort_order is required');
        await pool.query('UPDATE list_items SET sort_order = $1 WHERE id = $2 AND list_id = $3', [parseInt(sort_order, 10), item_id, list_id]);
        return res.json({ success: true });
      }

      throw new AppError(404, `Unknown list action: ${action}`);
    }

    if (resource === 'template') {
      const admin = await requireAdmin(req, res);
      const action = body.action;

      if (action === 'create') {
        const { name, category, description, image_url, deadline, link, structured_data } = body;
        if (!name) throw new AppError(400, 'Template name is required');
        const result = await pool.query('INSERT INTO templates (name, category, description, image_url, deadline, link, structured_data) VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id', [name, category || '', description || '', image_url || '', deadline || '', link || '', JSON.stringify(structured_data || {})]);
        return res.status(201).json({ id: result.rows[0].id, success: true });
      }

      if (action === 'update') {
        const { id, name, category, description, image_url, deadline, link, structured_data } = body;
        const sets = [];
        const params = [];
        let idx = 1;
        const fieldMap = { name, category, description, image_url, deadline, link };
        for (const [key, val] of Object.entries(fieldMap)) {
          if (val !== undefined) { sets.push(`${key} = $${idx++}`); params.push(val); }
        }
        if (structured_data !== undefined) { sets.push(`structured_data = $${idx++}`); params.push(JSON.stringify(structured_data)); }
        if (!sets.length) throw new AppError(400, 'No fields to update');
        sets.push('updated_date = now()');
        params.push(id);
        await pool.query(`UPDATE templates SET ${sets.join(', ')} WHERE id = $${idx}`, params);
        return res.json({ success: true });
      }

      if (action === 'delete') {
        await pool.query('DELETE FROM templates WHERE id = $1', [body.id]);
        return res.json({ success: true });
      }

      throw new AppError(404, `Unknown template action: ${action}`);
    }

    throw new AppError(404, `Unknown resource: ${resource}`);
  } catch (err) {
    next(err);
  }
});

export default router;
