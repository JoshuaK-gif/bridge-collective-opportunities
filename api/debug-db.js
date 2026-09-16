import { getPool } from './_db.js';

export default async function handler(req, res) {
  res.setHeader('Access-Control-Allow-Origin', '*');
  res.setHeader('Cache-Control', 'no-store');

  const debug = {};

  // Show which env vars exist (masked)
  const vars = ['DATABASE_URL', 'POSTGRES_URL', 'POSTGRES_PRISMA_URL', 'NHOST_SUBDOMAIN', 'NHOST_REGION'];
  debug.env = {};
  for (const v of vars) {
    const val = process.env[v];
    if (val) {
      // Show first 20 and last 10 chars, mask the rest
      debug.env[v] = val.length > 30
        ? val.substring(0, 20) + '...' + val.substring(val.length - 10)
        : val.substring(0, 8) + '...';
    } else {
      debug.env[v] = 'NOT SET';
    }
  }

  // Show which variable the code picks
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

  debug.pickedVar = picked;
  debug.hasAt = connStr.includes('@');
  debug.rawLength = connStr.length;

  // Show host portion (between @ and :5432)
  if (connStr.includes('@')) {
    const afterAt = connStr.split('@')[1];
    debug.host = afterAt.split(':')[0];
    debug.hasSslRequire = connStr.includes('sslmode=require');
  }

  try {
    const pool = getPool();
    const result = await pool.query('SELECT NOW() as time, current_database() as db, current_user as "user"');
    debug.success = true;
    debug.result = result.rows[0];
    res.status(200).json(debug);
  } catch (err) {
    debug.success = false;
    debug.error = err.message;
    debug.code = err.code;
    debug.detail = err.detail;
    debug.hint = err.hint;
    res.status(500).json(debug);
  }
}
