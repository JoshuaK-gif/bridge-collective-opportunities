import { Router } from 'express';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';
import { authenticate } from '../auth.js';
import { AppError } from '../lib/errors.js';

const router = Router();

router.get('/', async (req, res, next) => {
  try {
    const limit = Math.min(parseInt(req.query.limit, 10) || 50, 200);
    const result = await pool.query('SELECT * FROM news ORDER BY published_date DESC LIMIT $1', [limit]);
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

router.get('/:id', async (req, res, next) => {
  try {
    const result = await pool.query('SELECT * FROM news WHERE id = $1', [req.params.id]);
    if (!result.rows.length) throw new AppError(404, 'News not found');
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.post('/', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { title, content, image_url, link, published_date } = req.body;
    if (!title) throw new AppError(400, 'Title is required');
    const result = await pool.query(
      'INSERT INTO news (title, content, image_url, link, published_date) VALUES ($1,$2,$3,$4,COALESCE($5::timestamptz, now())) RETURNING *',
      [title, content || '', image_url || '', link || '', published_date || null]
    );
    logger.info({ newsId: result.rows[0].id, title }, 'News created');
    res.status(201).json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.put('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const { title, content, image_url, link, published_date } = req.body;
    const result = await pool.query(
      `UPDATE news SET title = COALESCE($1, title), content = COALESCE($2, content), image_url = COALESCE($3, image_url),
       link = COALESCE($4, link), published_date = COALESCE($5::timestamptz, published_date), updated_at = now()
       WHERE id = $6 RETURNING *`,
      [title, content, image_url, link, published_date || null, req.params.id]
    );
    if (!result.rows.length) throw new AppError(404, 'News not found');
    logger.info({ newsId: req.params.id }, 'News updated');
    res.json(result.rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    if (req.user.role !== 'admin') throw new AppError(403, 'Forbidden');
    const result = await pool.query('DELETE FROM news WHERE id = $1', [req.params.id]);
    if (!result.rowCount) throw new AppError(404, 'News not found');
    logger.info({ newsId: req.params.id }, 'News deleted');
    res.json({ success: true });
  } catch (err) {
    next(err);
  }
});

export default router;
