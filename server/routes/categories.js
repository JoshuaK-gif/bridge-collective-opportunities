import { Router } from 'express';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';
import { AppError } from '../lib/errors.js';
import { validate, categorySchema } from '../lib/validate.js';
import { logAudit } from '../lib/audit.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM categories ORDER BY name ASC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM categories WHERE id = $1', [req.params.id]);
    if (!result.rows.length) throw new AppError(404, 'Category not found');
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, validate(categorySchema), async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { name, description, icon, color, accent, accent_bg } = req.body;
    const existing = await pool.query('SELECT id FROM categories WHERE name = $1', [name]);
    if (existing.rows.length) throw new AppError(409, 'Category already exists');
    const result = await pool.query(
      'INSERT INTO categories (name, description, icon, color, accent, accent_bg) VALUES ($1,$2,$3,$4,$5,$6) RETURNING *',
      [name, description || '', icon || 'Briefcase', color || 'text-blue-600 bg-blue-100', accent || 'bg-blue-500', accent_bg || 'bg-blue-50']
    );
    logAudit({ userId: req.user.id, action: 'create', entityType: 'category', entityId: result.rows[0].id, ipAddress: req.ip });
    logger.info({ categoryId: result.rows[0].id, name }, 'Category created');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { name, description, icon, color, accent, accent_bg } = req.body;
    const result = await pool.query(
      'UPDATE categories SET name = COALESCE($1, name), description = COALESCE($2, description), icon = COALESCE($3, icon), color = COALESCE($4, color), accent = COALESCE($5, accent), accent_bg = COALESCE($6, accent_bg), updated_date = now() WHERE id = $7 RETURNING *',
      [name, description, icon, color, accent, accent_bg, req.params.id]
    );
    if (!result.rows.length) throw new AppError(404, 'Category not found');
    logAudit({ userId: req.user.id, action: 'update', entityType: 'category', entityId: req.params.id, ipAddress: req.ip });
    logger.info({ categoryId: req.params.id }, 'Category updated');
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    await pool.query('UPDATE opportunities SET category = \'\' WHERE category = (SELECT name FROM categories WHERE id = $1)', [req.params.id]);
    const result = await pool.query('DELETE FROM categories WHERE id = $1', [req.params.id]);
    if (!result.rowCount) throw new AppError(404, 'Category not found');
    logAudit({ userId: req.user.id, action: 'delete', entityType: 'category', entityId: req.params.id, ipAddress: req.ip });
    logger.info({ categoryId: req.params.id }, 'Category deleted');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
