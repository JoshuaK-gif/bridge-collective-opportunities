import { Router } from 'express';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM templates ORDER BY updated_date DESC');
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM templates WHERE id = $1', [req.params.id]);
    if (!result.rows.length) throw new AppError(404, 'Template not found');
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { name, category, description, image_url, deadline, link, structured_data } = req.body;
    if (!name) throw new AppError(400, 'Template name is required');
    const result = await pool.query(
      `INSERT INTO templates (name, category, description, image_url, deadline, link, structured_data)
       VALUES ($1,$2,$3,$4,$5,$6,$7) RETURNING id`,
      [name, category || '', description || '', image_url || '', deadline || '', link || '', JSON.stringify(structured_data || {})]
    );
    logger.info({ templateId: result.rows[0].id, name }, 'Template created');
    res.status(201).json({ id: result.rows[0].id, success: true });
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { name, category, description, image_url, deadline, link, structured_data } = req.body;
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
    params.push(req.params.id);
    await pool.query(`UPDATE templates SET ${sets.join(', ')} WHERE id = $${idx}`, params);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    await pool.query('DELETE FROM templates WHERE id = $1', [req.params.id]);
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
