import pg from 'pg';
const { Pool } = pg;
import { setCORS } from './_db.js';

export default async function handler(req, res) {
  setCORS(res);
  res.setHeader('Cache-Control', 'no-store');
  if (req.method === 'OPTIONS') { res.status(200).end(); return; }

  const debug = {};

  // Show which env vars exist
  const vars = ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL'];
  debug.env = {};
  for (const v of vars) {
    const val = process.env[v];
    if (val) {
      const afterAt = val.split('@')[1] || '';
      const host = afterAt.split(':')[0];
      const user = val.split('//')[1]?.split(':')[0];
      debug.env[v] = { host, user, length: val.length };
    } else {
      debug.env[v] = 'NOT SET';
    }
  }

  // Pick the connection string like _db.js does
  let connStr = (process.env.DATABASE_URL || '').trim();
  let picked = 'DATABASE_URL';
  if (!connStr || !connStr.includes('@')) {
    connStr = (process.env.POSTGRES_URL || '').trim();
    picked = 'POSTGRES_URL';
  }
  if (!connStr || !connStr.includes('@')) {
    connStr = (process.env.POSTGRES_PRISMA_URL || '').trim();
    picked = 'POSTGRES_PRISMA_URL';
  }
  connStr = connStr.replace(/^postgres:\/\//, 'postgresql://');

  debug.pickedVar = picked;
  debug.connLength = connStr.length;

  if (!connStr) {
    debug.error = 'No connection string found';
    return res.status(500).json(debug);
  }

  // Allow POST to test with a custom password
  if (req.method === 'POST') {
    try {
      const chunks = [];
      for await (const chunk of req) chunks.push(chunk);
      const body = JSON.parse(Buffer.concat(chunks).toString());
      if (body.password) {
        connStr = connStr.replace(/:([^@]+)@/, `:${body.password}@`);
        debug.testingCustomPassword = true;
      }
    } catch {}
  }

  // Test the connection
  const pool = new Pool({
    connectionString: connStr,
    ssl: { rejectUnauthorized: false },
    max: 1,
    connectionTimeoutMillis: 15000,
  });

  try {
    const result = await pool.query('SELECT NOW() as time, current_database() as db_name, current_user as db_user');
    debug.success = true;
    debug.result = result.rows[0];
    res.status(200).json(debug);
  } catch (err) {
    debug.success = false;
    debug.error = err.message;
    debug.code = err.code;
    debug.hint = err.hint;
    // Show the host we tried to connect to
    if (connStr.includes('@')) {
      debug.attemptedHost = connStr.split('@')[1].split(':')[0];
    }
    res.status(500).json(debug);
  } finally {
    await pool.end();
  }
}
