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
  const hasDbUrl = !!process.env.DATABASE_URL;
  const hasNhostDbUrl = !!process.env.NHOST_DATABASE_URL;
  checks.debug = { hasDbUrl, hasNhostDbUrl };
  try {
    await query('SELECT 1');
    checks.db = 'connected';
  } catch (err) {
    checks.db = 'disconnected';
    checks.status = 'degraded';
    checks.dbError = err?.message || String(err);
    checks.dbCode = err?.code || null;
  }
  res.status(checks.status === 'ok' ? 200 : 503).json(checks);
});
