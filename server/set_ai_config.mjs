import 'dotenv/config';
import pool from './lib/db.js';

const config = JSON.stringify({
  provider: 'opencodezen',
  model: 'opencode/deepseek-v4-flash-free',
  enabled: true,
});

await pool.query(
  `INSERT INTO site_settings (key, value, updated_at) VALUES ($1, $2, now()) ON CONFLICT (key) DO UPDATE SET value = $2, updated_at = now()`,
  ['openai_config', config]
);

console.log('AI config inserted successfully');

const check = await pool.query('SELECT value FROM site_settings WHERE key = $1', ['openai_config']);
console.log('Verified:', check.rows[0]?.value);

process.exit(0);
