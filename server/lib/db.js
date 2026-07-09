import pg from 'pg';
import logger from './logger.js';

const { Pool } = pg;
const USE_PGLITE = process.env.USE_PGLITE === 'true';

let pool;
let pglite;

async function getPglite() {
  if (!pglite) {
    const { PGlite } = await import('@electric-sql/pglite');
    pglite = new PGlite({ dataDir: './pglite-data' });
    logger.info('PGlite instance created');
  }
  return pglite;
}

if (!USE_PGLITE) {
  pool = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DB_POOL_MAX) || 50,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: 10000,
    ssl: process.env.DB_SSL === 'true' ? { rejectUnauthorized: false } : false,
  });

  pool.on('error', (err) => {
    logger.error({ err }, 'Unexpected PG pool error');
  });
}

export async function query(text, params) {
  const start = Date.now();
  let result;
  if (USE_PGLITE) {
    const db = await getPglite();
    const q = await db.query(text, params);
    result = {
      rows: q.rows || [],
      rowCount: q.affectedRows || q.rows?.length || 0,
      affectedRows: q.affectedRows,
      fields: q.fields,
    };
  } else {
    result = await pool.query(text, params);
  }
  const duration = Date.now() - start;
  if (duration > 1000) {
    logger.warn({ duration, text }, 'Slow query');
  }
  return result;
}

export async function initPglite() {
  if (!USE_PGLITE) return;
  const db = await getPglite();
  await db.query(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT now()
  )`);
}

export async function closePglite() {
  if (pglite) {
    await pglite.close();
    pglite = null;
  }
}

async function ensurePgliteExtensions() {
  if (!USE_PGLITE) return;
  const db = await getPglite();
  try { await db.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`); } catch {}
  try { await db.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`); } catch {}
  try { await db.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`); } catch {}
}

const pglitePool = {
  query,
  getPglite,
  end: closePglite,
};

export { initPglite as ensureMigrationsTable, ensurePgliteExtensions };
export default USE_PGLITE ? pglitePool : pool;