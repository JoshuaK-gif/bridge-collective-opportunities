import { Pool } from 'pg';

let _pool;

export function getPool() {
  if (!_pool) {
    let connStr = process.env.DATABASE_URL || '';
    // Ensure postgresql:// prefix for pg v8+
    connStr = connStr.replace(/^postgres:\/\//, 'postgresql://');
    // If the URL is empty or broken, try POSTGRES_URL as fallback
    if (!connStr || !connStr.includes('@')) {
      connStr = process.env.POSTGRES_URL || process.env.POSTGRES_PRISMA_URL || '';
      connStr = connStr.replace(/^postgres:\/\//, 'postgresql://');
    }
    console.log('DB connecting to:', connStr ? connStr.replace(/:[^:@]+@/, ':***@') : 'NO URL SET');
    _pool = new Pool({
      connectionString: connStr,
      ssl: connStr.includes('localhost') ? false : { rejectUnauthorized: false },
    });
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
