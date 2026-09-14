import { getPool, setCORS, parseQuery } from './_db.js';

export default async function handler(req, res) {
  setCORS(res);
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  try {
    const pool = getPool();
    const result = await pool.query('SELECT key, value FROM site_settings');
    const settings = {};
    result.rows.forEach(r => { settings[r.key] = r.value; });
    res.status(200).json(settings);
  } catch (error) {
    console.error('Settings API error:', error);
    res.status(500).json({ error: error.message });
  }
}
