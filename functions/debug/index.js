/**
 * TEMPORARY diagnostic endpoint — remove after deployment issues are resolved.
 * GET /v1/debug — reports env var presence + live DB test.
 */
import { query } from '../_shared/db.js';
import { handle } from '../_shared/errors.js';

export default handle(async (req, res) => {
  const env = {};
  for (const k of Object.keys(process.env).sort()) {
    if (/NHOST|DATABASE|SITE|CLOUD|JWT|HASURA|DB_|PG|CRON/.test(k)) {
      const v = process.env[k];
      env[k] = v ? `(set, ${v.length} chars)` : '(empty)';
    }
  }
  const out = { env };
  try {
    await query('SELECT 1');
    out.db = 'connected';
  } catch (e) {
    out.db = 'FAILED: ' + (e?.message || String(e));
  }
  res.json(out);
});
