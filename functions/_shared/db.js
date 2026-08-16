/**
 * Shared Postgres pool for Nhost Functions.
 *
 * Points at Nhost's managed Postgres via DATABASE_URL, which must be set as a
 * custom environment variable in the Nhost dashboard (Database → Connect →
 * connection string). Same shape as the old server/lib/db.js, minus PGlite.
 */
import pg from 'pg';

const { Pool } = pg;

let pool = null;

export function getPool() {
  if (!pool) {
    if (!process.env.DATABASE_URL) {
      throw new Error('DATABASE_URL is not set — add the Nhost Postgres connection string as an env var');
    }
    pool = new Pool({
      connectionString: process.env.DATABASE_URL,
      max: parseInt(process.env.DB_POOL_MAX, 10) || 5,
      idleTimeoutMillis: 30000,
      connectionTimeoutMillis: 10000,
      ssl: process.env.DB_SSL === 'false' ? false : { rejectUnauthorized: false },
    });
    pool.on('error', (err) => {
      console.error('[db] unexpected pool error', err);
    });
  }
  return pool;
}

export async function query(text, params) {
  const start = Date.now();
  try {
    return await getPool().query(text, params);
  } finally {
    const duration = Date.now() - start;
    if (duration > 1000) {
      console.warn(`[db] slow query (${duration}ms): ${text}`);
    }
  }
}

export default { query, getPool };
