import { Router } from 'express';
import { v4 as uuidv4 } from 'uuid';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';
import { AppError } from '../lib/errors.js';
import { validate, listSchema, listItemSchema } from '../lib/validate.js';
import { logAudit } from '../lib/audit.js';

const router = Router();

// GET /api/lists — get all lists (public)
router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query(
      'SELECT * FROM lists ORDER BY sort_order ASC, created_date DESC'
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

// GET /api/lists/:id — get a single list with its items (public)
router.get('/:id', async (req, res, next) => {
  try {
    const listResult = await pool.query('SELECT * FROM lists WHERE id = $1', [req.params.id]);
    if (!listResult.rows.length) throw new AppError(404, 'List not found');
    const list = listResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT o.*, li.id AS list_item_id, li.sort_order AS list_sort_order
       FROM list_items li
       JOIN opportunities o ON o.id = li.opportunity_id
       WHERE li.list_id = $1
       ORDER BY li.sort_order ASC, o.created_date DESC`,
      [req.params.id]
    );
    list.items = itemsResult.rows;
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// GET /api/lists/:slug/items — get items for a list by slug (public)
router.get('/slug/:slug', async (req, res, next) => {
  try {
    const listResult = await pool.query('SELECT * FROM lists WHERE slug = $1', [req.params.slug]);
    if (!listResult.rows.length) throw new AppError(404, 'List not found');
    const list = listResult.rows[0];

    const itemsResult = await pool.query(
      `SELECT o.*, li.id AS list_item_id, li.sort_order AS list_sort_order
       FROM list_items li
       JOIN opportunities o ON o.id = li.opportunity_id
       WHERE li.list_id = $1
       ORDER BY li.sort_order ASC, o.created_date DESC`,
      [list.id]
    );
    list.items = itemsResult.rows;
    res.json(list);
  } catch (err) {
    next(err);
  }
});

// POST /api/lists — create a new list (admin only)
router.post('/', authenticate, validate(listSchema), async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { name, description } = req.body;

    const slug = name
      .toLowerCase()
      .replace(/[^a-z0-9]+/g, '-')
      .replace(/^-|-$/g, '')
      .substring(0, 60) || 'list';

    // Ensure unique slug
    let finalSlug = slug;
    let slugIdx = 1;
    while (true) {
      const existing = await pool.query('SELECT id FROM lists WHERE slug = $1', [finalSlug]);
      if (!existing.rows.length) break;
      finalSlug = `${slug}-${slugIdx++}`;
    }

    const id = uuidv4();
    await pool.query(
      'INSERT INTO lists (id, name, slug, description) VALUES ($1, $2, $3, $4)',
      [id, name, finalSlug, description || '']
    );
    logAudit({ userId: req.user.id, action: 'create', entityType: 'list', entityId: id, ipAddress: req.ip });
    logger.info({ listId: id, name }, 'List created');
    res.status(201).json({ id, slug: finalSlug, success: true });
  } catch (err) {
    next(err);
  }
});

// PUT /api/lists/:id — update a list (admin only)
router.put('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { name, description, sort_order } = req.body;
    const result = await pool.query(
      'UPDATE lists SET name = COALESCE($1, name), description = COALESCE($2, description), sort_order = COALESCE($3, sort_order), updated_date = now() WHERE id = $4 RETURNING *',
      [name, description, sort_order, req.params.id]
    );
    if (!result.rows.length) throw new AppError(404, 'List not found');
    logAudit({ userId: req.user.id, action: 'update', entityType: 'list', entityId: req.params.id, ipAddress: req.ip });
    logger.info({ listId: req.params.id }, 'List updated');
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

// DELETE /api/lists/:id — delete a list (cascades to items) (admin only)
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const result = await pool.query('DELETE FROM lists WHERE id = $1', [req.params.id]);
    if (!result.rowCount) throw new AppError(404, 'List not found');
    logAudit({ userId: req.user.id, action: 'delete', entityType: 'list', entityId: req.params.id, ipAddress: req.ip });
    logger.info({ listId: req.params.id }, 'List deleted');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// POST /api/lists/:id/items — add an opportunity to a list (admin only)
router.post('/:id/items', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { opportunity_id } = listItemSchema.parse(req.body);

    // Check list exists
    const listExists = await pool.query('SELECT id FROM lists WHERE id = $1', [req.params.id]);
    if (!listExists.rows.length) throw new AppError(404, 'List not found');

    // Check opportunity exists
    const oppExists = await pool.query('SELECT id FROM opportunities WHERE id = $1', [opportunity_id]);
    if (!oppExists.rows.length) throw new AppError(404, 'Opportunity not found');

    // Get max sort_order for this list
    const maxOrder = await pool.query(
      'SELECT COALESCE(MAX(sort_order), 0) + 1 AS next_order FROM list_items WHERE list_id = $1',
      [req.params.id]
    );

    const id = uuidv4();
    await pool.query(
      'INSERT INTO list_items (id, list_id, opportunity_id, sort_order) VALUES ($1, $2, $3, $4) ON CONFLICT (list_id, opportunity_id) DO NOTHING',
      [id, req.params.id, opportunity_id, maxOrder.rows[0].next_order]
    );
    logger.info({ listId: req.params.id, opportunityId: opportunity_id }, 'Item added to list');
    res.status(201).json({ id, success: true });
  } catch (err) {
    next(err);
  }
});

// DELETE /api/lists/:listId/items/:itemId — remove an item from a list (admin only)
router.delete('/:listId/items/:itemId', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const result = await pool.query(
      'DELETE FROM list_items WHERE id = $1 AND list_id = $2',
      [req.params.itemId, req.params.listId]
    );
    if (!result.rowCount) throw new AppError(404, 'Item not found in list');
    logger.info({ listId: req.params.listId, itemId: req.params.itemId }, 'Item removed from list');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

// PUT /api/lists/:listId/items/:itemId/reorder — reorder an item (admin only)
router.put('/:listId/items/:itemId/reorder', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { sort_order } = req.body;
    if (sort_order === undefined) throw new AppError(400, 'sort_order is required');
    await pool.query(
      'UPDATE list_items SET sort_order = $1 WHERE id = $2 AND list_id = $3',
      [sort_order, req.params.itemId, req.params.listId]
    );
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
