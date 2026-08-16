/**
 * Smoke test for the Nhost Functions backend.
 *
 * Loads each function's default handler and calls it with mock Express
 * req/res objects against the real Nhost Postgres (DATABASE_URL). Read-only —
 * exercises the SQL + handler wiring end to end.
 *
 * Usage: set -a && source server/.env.nhost && set +a && node scripts/smoke-functions.mjs
 */
import { createRequire } from 'module';
const require = createRequire(import.meta.url);

function mockRes() {
  const res = {
    _status: 200,
    _sent: false,
    _body: null,
    headers: {},
    status(c) { this._status = c; return this; },
    set(k, v) { this.headers[k] = v; return this; },
    json(d) { this._body = d; this._sent = true; return this; },
    send(d) { this._body = d; this._sent = true; return this; },
  };
  return res;
}

function mockReq({ method = 'GET', query = {}, body = {}, headers = {} } = {}) {
  return { method, query, body, headers, params: {} };
}

let pass = 0;
let fail = 0;
const failures = [];

function check(name, res, expectStatus, validate) {
  if (!res._sent) {
    fail++; failures.push(`${name}: handler never responded`);
    return;
  }
  if (res._status !== expectStatus) {
    fail++; failures.push(`${name}: expected ${expectStatus}, got ${res._status} — ${JSON.stringify(res._body).slice(0, 200)}`);
    return;
  }
  try {
    validate(res._body);
    pass++;
    console.log(`✓ ${name}`);
  } catch (err) {
    fail++; failures.push(`${name}: ${err.message}`);
  }
}

async function main() {
  const health = (await import('../functions/health/route.js')).default;
  const auth = (await import('../functions/auth/route.js')).default;
  const content = (await import('../functions/content/route.js')).default;
  const collections = (await import('../functions/collections/route.js')).default;
  const admin = (await import('../functions/admin/route.js')).default;
  const seo = (await import('../functions/seo/route.js')).default;
  const scraper = (await import('../functions/scraper/route.js')).default;
  const outreach = (await import('../functions/outreach/route.js')).default;
  const cron = (await import('../functions/cron/route.js')).default;

  // health
  let res = mockRes();
  await health(mockReq(), res);
  check('health: db connected + features', res, 200, (b) => {
    if (b.db !== 'connected') throw new Error(`db=${b.db}`);
    if (b.features?.ai !== false) throw new Error('features.ai should be false');
  });

  // content: opportunities list (seed has 12)
  res = mockRes();
  await content(mockReq({ query: { resource: 'opportunities' } }), res);
  check('content: opportunities list', res, 200, (b) => {
    if (!Array.isArray(b)) throw new Error('expected array');
    if (b.length < 1) throw new Error('expected seed opportunities');
  });

  // content: single opportunity (by query param)
  const opps = res._body;
  res = mockRes();
  await content(mockReq({ query: { resource: 'opportunity', id: opps[0].id } }), res);
  check('content: opportunity by id', res, 200, (b) => {
    if (!b || b.id !== opps[0].id) throw new Error('wrong opportunity');
  });

  // content: categories
  res = mockRes();
  await content(mockReq({ query: { resource: 'categories' } }), res);
  check('content: categories', res, 200, (b) => {
    if (!Array.isArray(b) || b.length < 1) throw new Error('expected categories');
  });

  // content: news
  res = mockRes();
  await content(mockReq({ query: { resource: 'news', limit: '5' } }), res);
  check('content: news', res, 200, (b) => {
    if (!Array.isArray(b)) throw new Error('expected array');
  });

  // content: related
  res = mockRes();
  await content(mockReq({ query: { resource: 'related', id: opps[0].id } }), res);
  check('content: related', res, 200, (b) => Array.isArray(b) || b === undefined);

  // collections: lists
  res = mockRes();
  await collections(mockReq({ query: { resource: 'lists' } }), res);
  check('collections: lists', res, 200, (b) => Array.isArray(b));

  // collections: templates
  res = mockRes();
  await collections(mockReq({ query: { resource: 'templates' } }), res);
  check('collections: templates', res, 200, (b) => Array.isArray(b));

  // admin: public setting — seed DB has no site_name row → 404 (correct)
  res = mockRes();
  await admin(mockReq({ query: { resource: 'setting', key: 'site_name' } }), res);
  check('admin: public setting (missing → 404)', res, 404, () => {});

  // admin: subscribers list requires auth → 401
  res = mockRes();
  await admin(mockReq({ query: { resource: 'subscribers' } }), res);
  check('admin: subscribers without token → 401', res, 401, () => {});

  // seo: sitemap
  res = mockRes();
  await seo(mockReq({ query: { type: 'sitemap' } }), res);
  check('seo: sitemap XML', res, 200, (b) => {
    if (typeof b !== 'string' || !b.includes('<urlset')) throw new Error('not a sitemap');
  });

  // seo: rss
  res = mockRes();
  await seo(mockReq({ query: { type: 'rss' } }), res);
  check('seo: rss XML', res, 200, (b) => {
    if (typeof b !== 'string' || !b.includes('<rss')) throw new Error('not rss');
  });

  // auth: login with no body → 400
  res = mockRes();
  await auth(mockReq({ method: 'POST', body: {} }), res);
  check('auth: login missing credentials → 400', res, 400, () => {});

  // cron: wrong secret → 401
  process.env.CRON_SECRET = 'test-secret';
  res = mockRes();
  await cron(mockReq({ method: 'POST', query: { job: 'expired-cleanup' }, headers: { 'x-cron-secret': 'wrong' } }), res);
  check('cron: wrong secret → 401', res, 401, () => {});

  // scraper: posts requires auth → 401
  res = mockRes();
  await scraper(mockReq({ query: { resource: 'posts' } }), res);
  check('scraper: posts without token → 401', res, 401, () => {});

  // scraper: process → 501 (AI disabled)
  res = mockRes();
  await scraper(mockReq({ method: 'POST', body: { resource: 'process', sourceId: 'x' } }), res);
  check('scraper: process → 501 (AI disabled)', res, 501, () => {});

  // content: enrich requires auth first → 401 (the 501 is behind admin auth)
  res = mockRes();
  await content(mockReq({ method: 'POST', body: { resource: 'opportunity', action: 'enrich', id: opps[0].id } }), res);
  check('content: enrich requires auth → 401', res, 401, () => {});

  console.log(`\n${pass} passed, ${fail} failed`);
  if (failures.length) {
    console.log('\nFailures:');
    for (const f of failures) console.log('  ✗ ' + f);
    process.exit(1);
  }
}

main().catch((err) => {
  console.error('SMOKE TEST CRASHED:', err);
  process.exit(1);
});
