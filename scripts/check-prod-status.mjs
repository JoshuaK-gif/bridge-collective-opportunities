import { readFileSync } from 'node:fs';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import pg from 'pg';

const here = dirname(fileURLToPath(import.meta.url));
let base = here;
function findEnv(dir) {
  try { return readFileSync(resolve(dir, '.env.nhost'), 'utf8'); } catch { return null; }
}
let nhostEnv = findEnv(base);
while (!nhostEnv) {
  const parent = resolve(base, '..');
  if (parent === base) break;
  base = parent;
  nhostEnv = findEnv(base);
}
if (!nhostEnv) { console.error('.env.nhost not found'); process.exit(1); }
const dbUrl = (nhostEnv.match(/^DATABASE_URL=(.+)$/m) || [])[1]?.trim();
const client = new pg.Client({ connectionString: dbUrl, ssl: true });
await client.connect();

function parseVal(v) { return typeof v === 'string' ? JSON.parse(v) : v; }

const smtp = await client.query("SELECT value FROM site_settings WHERE key='smtp_config'");
const smtpVal = smtp.rows.length ? parseVal(smtp.rows[0].value) : null;
console.log('smtp_config:');
console.log(JSON.stringify(smtpVal ? { ...smtpVal, pass: smtpVal.pass ? '***' : '', api_key: smtpVal.api_key ? '***' : '' } : null, null, 2));

const news = await client.query("SELECT value FROM site_settings WHERE key='last_newsletter_sent'");
console.log('last_newsletter_sent:', news.rows.length ? JSON.stringify(news.rows[0].value) : 'NOT SET');

const rem = await client.query("SELECT value FROM site_settings WHERE key='reminders'");
let rems = rem.rows.length ? parseVal(rem.rows[0].value) : [];
if (!Array.isArray(rems)) rems = [];
const sent = rems.filter(r => r.sent).length;
const pending = rems.filter(r => !r.sent).length;
console.log(`reminders stored: ${rems.length} (${sent} sent, ${pending} pending)`);
if (rems.length) console.log('sample:', JSON.stringify(rems[0]).slice(0, 250));

const subs = await client.query("SELECT email, is_active FROM subscribers WHERE is_active = true AND unsubscribed_at IS NULL");
console.log('active subscribers:', subs.rows.length, subs.rows.map(r => r.email).join(', '));

const todayOpps = await client.query("SELECT count(*) FROM opportunities WHERE status='active' AND created_date >= CURRENT_DATE");
console.log('active opportunities created today:', todayOpps.rows[0].count);

await client.end();