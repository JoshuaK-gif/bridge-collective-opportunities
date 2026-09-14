import { Pool } from 'pg';

let _pool;

export function getPool() {
  if (!_pool) {
    let connStr = (process.env.DATABASE_URL || '').trim();
    if (!connStr || !connStr.includes('@')) {
      connStr = (process.env.POSTGRES_URL || '').trim();
    }
    if (!connStr || !connStr.includes('@')) {
      connStr = (process.env.POSTGRES_PRISMA_URL || '').trim();
    }
    connStr = connStr.replace(/^postgres:\/\//, 'postgresql://');

    if (!connStr) {
      console.error('DATABASE_URL is not set');
      throw new Error('DATABASE_URL is not set');
    }

    try {
      const url = new URL(connStr);
      _pool = new Pool({
        host: url.hostname,
        port: parseInt(url.port, 10) || 5432,
        database: url.pathname.replace(/^\//, ''),
        user: url.username,
        password: decodeURIComponent(url.password),
        ssl: { rejectUnauthorized: false },
      });
    } catch (e) {
      console.error('DB parse error, trying raw connectionString:', e.message);
      _pool = new Pool({
        connectionString: connStr,
        ssl: { rejectUnauthorized: false },
      });
    }
  }
  return _pool;
}

/** CORS headers used by every API handler. */
export function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

/** Parse the JSON body from a POST request. */
export async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString();
  try { return JSON.parse(raw); } catch { return {}; }
}

/** Parse query-string params from the request URL. */
export function parseQuery(req) {
  const url = new URL(req.url, `https://${req.headers.host}`);
  const params = {};
  for (const [k, v] of url.searchParams) params[k] = v;
  return params;
}
