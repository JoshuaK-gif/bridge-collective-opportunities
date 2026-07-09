import { Router } from 'express';
import pool from '../lib/db.js';

const router = Router();

router.get('/:id', async (req, res, next) => {
  try {
    const opp = await pool.query('SELECT category, id FROM opportunities WHERE id = $1', [req.params.id]);
    if (!opp.rows.length) return res.json([]);

    const { category, id } = opp.rows[0];
    const result = await pool.query(
      "SELECT id, title, image_url, category, deadline, created_date FROM opportunities WHERE category = $1 AND id != $2 AND status = 'active' ORDER BY created_date DESC LIMIT 4",
      [category, id]
    );
    res.json(result.rows);
  } catch (err) {
    next(err);
  }
});

export default router;
