import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import pool, { initPglite } from './db.js';
import logger from './logger.js';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const MIGRATIONS_DIR = path.join(__dirname, '..', 'migrations');

export async function runMigrations() {
  if (process.env.USE_PGLITE === 'true') {
    await initPglite();
  }
  await pool.query(`
    CREATE TABLE IF NOT EXISTS _migrations (
      name TEXT PRIMARY KEY,
      applied_at TIMESTAMPTZ DEFAULT now()
    )
  `);

  if (!fs.existsSync(MIGRATIONS_DIR)) {
    fs.mkdirSync(MIGRATIONS_DIR, { recursive: true });
    return;
  }

  const files = fs.readdirSync(MIGRATIONS_DIR)
    .filter(f => f.endsWith('.sql'))
    .sort();

  for (const file of files) {
    const existing = await pool.query('SELECT name FROM _migrations WHERE name = $1', [file]);
    if (existing.rows.length) continue;

    const sql = fs.readFileSync(path.join(MIGRATIONS_DIR, file), 'utf8');
    const statements = sql.split(';').map(s => s.trim()).filter(s => s.length > 0);
    for (const stmt of statements) {
      try {
        await pool.query(stmt);
      } catch (err) {
        logger.warn({ migration: file, statement: stmt.substring(0, 80), error: err.message }, 'Skipping statement');
      }
    }
    await pool.query('INSERT INTO _migrations (name) VALUES ($1)', [file]);
    logger.info({ migration: file }, 'Migration applied');
  }
}
