/**
 * Shared Postgres pool for Nhost Functions.
 *
 * Points at Nhost's managed Postgres via DATABASE_URL, which must be set as a
 * custom environment variable in the Nhost dashboard (Database → Connect →
 * connection string). Same shape as the old server/lib/db.js, minus PGlite.
 *
 * Includes retry + pool-reset logic to survive free-tier database sleep/wake
 * cycles: when Postgres pauses after inactivity, existing pool connections die
 * silently. Without a reset, every subsequent request on a warm function
 * instance keeps trying to use dead connections and fails.
 */
import pg from 'pg';

const { Pool } = pg;

let pool = null;
let poolFailedAt = 0;

const CONNECT_TIMEOUT_MS = parseInt(process.env.DB_CONNECT_TIMEOUT_MS, 10) || 15000;
const RETRY_ATTEMPTS = parseInt(process.env.DB_RETRY_ATTEMPTS, 10) || 2;
const RETRY_DELAY_MS = 800;

function createPool() {
  if (!process.env.DATABASE_URL) {
    throw new Error('DATABASE_URL is not set — add the Nhost Postgres connection string as an env var');
  }
  // If the connection string already specifies sslmode, don't override it —
  // conflicting SSL config is a common cause of silent connection failures.
  const urlHasSsl = /sslmode=/i.test(process.env.DATABASE_URL);
  const sslConfig = process.env.DB_SSL === 'false'
    ? false
    : urlHasSsl
      ? undefined  // let the connection string's sslmode win
      : { rejectUnauthorized: false };
  const p = new Pool({
    connectionString: process.env.DATABASE_URL,
    max: parseInt(process.env.DB_POOL_MAX, 10) || 5,
    idleTimeoutMillis: 30000,
    connectionTimeoutMillis: CONNECT_TIMEOUT_MS,
    ...(sslConfig !== undefined && { ssl: sslConfig }),
  });
  p.on('error', (err) => {
    console.error('[db] unexpected pool error', err);
  });
  return p;
}

function resetPool() {
  if (pool) {
    try { pool.end().catch(() => {}); } catch { /* already closed */ }
    pool = null;
  }
  poolFailedAt = Date.now();
}

export function getPool() {
  // Rebuild the pool after a failure so we don't reuse dead connections
  // left over from a database sleep/wake cycle.
  if (!pool || poolFailedAt) {
    if (pool) resetPool();
    pool = createPool();
    poolFailedAt = 0;
  }
  return pool;
}

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

export async function query(text, params) {
  const start = Date.now();
  let lastErr;
  for (let attempt = 0; attempt <= RETRY_ATTEMPTS; attempt++) {
    try {
      return await getPool().query(text, params);
    } catch (err) {
      lastErr = err;
      const isConnectionErr =
        err.code === 'ECONNREFUSED' ||
        err.code === 'ETIMEDOUT' ||
        err.code === 'ENOTFOUND' ||
        err.code === 'ECONNRESET' ||
        err.code === '57P03' || // cannot_connect_now (PostgreSQL restarting)
        err.code === '08006' || // connection_failure
        err.code === '08003' || // connection_does_not_exist
        err.code === '08001' || // sqlclient_unable_to_establish_sqlconnection
        /connection|timeout|terminat|closed|ECONN/i.test(err.message || '');
      if (isConnectionErr && attempt < RETRY_ATTEMPTS) {
        console.warn(`[db] connection error (attempt ${attempt + 1}/${RETRY_ATTEMPTS + 1}): ${err.message} — resetting pool and retrying`);
        resetPool();
        await sleep(RETRY_DELAY_MS * (attempt + 1));
        continue;
      }
      // Mark pool as failed so the next request rebuilds it
      poolFailedAt = Date.now();
      throw err;
    }
  }
  throw lastErr;
}

export default { query, getPool };
