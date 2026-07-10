import { Router } from 'express';
import pool from '../lib/db.js';
import logger from '../lib/logger.js';

const router = Router();

function generateToken() {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  let token = '';
  for (let i = 0; i < 24; i++) {
    token += chars[Math.floor(Math.random() * chars.length)];
  }
  return token;
}

router.post('/', async (req, res) => {
  try {
    const { data, token } = req.body;
    if (!data) return res.status(400).json({ error: 'No data provided' });

    if (token) {
      const existing = await pool.query('SELECT id FROM resumes WHERE token = $1', [token]);
      if (existing.rows.length) {
        await pool.query(
          'UPDATE resumes SET data = $1, updated_at = now() WHERE token = $2',
          [JSON.stringify(data), token]
        );
        return res.json({ token, updated: true });
      }
    }

    const newToken = token || generateToken();
    await pool.query(
      'INSERT INTO resumes (data, token) VALUES ($1, $2)',
      [JSON.stringify(data), newToken]
    );
    res.json({ token: newToken, created: true });
  } catch (err) {
    logger.error({ err: err.message }, 'Resume save failed');
    res.status(500).json({ error: 'Failed to save resume' });
  }
});

router.get('/:token', async (req, res) => {
  try {
    const result = await pool.query('SELECT data, updated_at FROM resumes WHERE token = $1', [req.params.token]);
    if (!result.rows.length) return res.status(404).json({ error: 'Resume not found' });
    res.json({ data: result.rows[0].data, updated_at: result.rows[0].updated_at });
  } catch (err) {
    logger.error({ err: err.message }, 'Resume load failed');
    res.status(500).json({ error: 'Failed to load resume' });
  }
});

router.delete('/:token', async (req, res) => {
  try {
    await pool.query('DELETE FROM resumes WHERE token = $1', [req.params.token]);
    res.json({ success: true });
  } catch (err) {
    logger.error({ err: err.message }, 'Resume delete failed');
    res.status(500).json({ error: 'Failed to delete resume' });
  }
});

export default router;
