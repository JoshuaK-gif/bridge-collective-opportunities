/**
 * GET /v1/health — status + DB check + feature flags.
 *
 * The Nhost free-tier backend runs WITHOUT AI, GrantKit or PDF features
 * (they need compute/containers the free tier doesn't provide). The frontend
 * reads `features` to hide those UI sections.
 */
import { query } from '../_shared/db.js';
import { handle } from '../_shared/errors.js';

export default handle(async (req, res) => {
  const checks = { status: 'ok', features: { ai: false, grantAssistant: false, pdf: false } };
  try {
    await query('SELECT 1');
    checks.db = 'connected';
  } catch {
    checks.db = 'disconnected';
    checks.status = 'degraded';
  }
  res.status(checks.status === 'ok' ? 200 : 503).json(checks);
});
