import pg from 'pg';
const { Pool } = pg;

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
      throw new Error('DATABASE_URL is not set');
    }

    _pool = new Pool({
      connectionString: connStr,
      ssl: { rejectUnauthorized: false },
      max: 5,
      idleTimeoutMillis: 10000,
      connectionTimeoutMillis: 15000,
    });
  }
  return _pool;
}

export function setCORS(res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Access-Control-Allow-Methods', 'GET, POST, DELETE, OPTIONS');
  res.setHeader('Access-Control-Allow-Headers', 'Content-Type, Authorization');
}

export async function readBody(req) {
  const chunks = [];
  for await (const chunk of req) chunks.push(chunk);
  const raw = Buffer.concat(chunks).toString();
  try { return JSON.parse(raw); } catch { return {}; }
}

export function parseQuery(req) {
  const params = {};

  // Vercel populates `req.query`, and for rewritten routes that is where the
  // destination's params end up. Merge it with the URL so both work.
  if (req.query && typeof req.query === 'object') {
    for (const [k, v] of Object.entries(req.query)) {
      if (v !== undefined) params[k] = Array.isArray(v) ? v[v.length - 1] : v;
    }
  }

  try {
    const url = new URL(req.url, `https://${req.headers?.host || 'localhost'}`);
    for (const [k, v] of url.searchParams) params[k] = v;
  } catch {
    // req.url was unparseable — the injected query params above still stand.
  }

  return params;
}
