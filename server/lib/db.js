import pg from 'pg';
import logger from './logger.js';

const { Pool } = pg;

let pool;
let pglite;

function getPool() {
  if (!pool) {
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DB_POOL_MAX) || 50,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: process.env.DB_SSL === 'true' ? {} : false,
    });
    pool.on('error', (err) => {
      logger.error({ err }, 'Unexpected PG pool error');
    });
  }
  return pool;
}

async function getPglite() {
  if (!pglite) {
    const { PGlite } = await import('@electric-sql/pglite');
    pglite = new PGlite({ dataDir: './pglite-data' });
    logger.info('PGlite instance created');
  }
  return pglite;
}

export async function query(text, params) {
  const start = Date.now();
  let result;
  const timeout = setTimeout(() => {
    logger.error({ text }, 'Query timed out after 30s');
  }, 30000);
  try {
    if (process.env.USE_PGLITE === 'true') {
      const db = await getPglite();
      const q = await db.query(text, params);
      result = {
        rows: q.rows || [],
        rowCount: q.affectedRows || q.rows?.length || 0,
        affectedRows: q.affectedRows,
        fields: q.fields,
      };
    } else {
      result = await getPool().query(text, params);
    }
  } finally {
    clearTimeout(timeout);
  }
  const duration = Date.now() - start;
  if (duration > 1000) {
    logger.warn({ duration, text }, 'Slow query');
  }
  return result;
}

export async function initPglite() {
  if (process.env.USE_PGLITE !== 'true') return;
  const db = await getPglite();
  await db.query(`CREATE TABLE IF NOT EXISTS _migrations (
    name TEXT PRIMARY KEY,
    applied_at TIMESTAMPTZ DEFAULT now()
  )`);
}

async function closePglite() {
  if (pglite) {
    await pglite.close();
    pglite = null;
  }
}

async function closePool() {
  if (pool) {
    await pool.end();
    pool = null;
  }
}

async function ensurePgliteExtensions() {
  if (process.env.USE_PGLITE !== 'true') return;
  const db = await getPglite();
  try { await db.query(`CREATE EXTENSION IF NOT EXISTS pg_trgm`); } catch {}
  try { await db.query(`CREATE EXTENSION IF NOT EXISTS pgcrypto`); } catch {}
  try { await db.query(`CREATE EXTENSION IF NOT EXISTS "uuid-ossp"`); } catch {}
}

export { initPglite as ensureMigrationsTable, ensurePgliteExtensions };

const dbProxy = {
  query,
  getPglite,
  end: process.env.USE_PGLITE === 'true' ? closePglite : closePool,
};

export default dbProxy;