import pg from 'pg';
import fs from 'fs';
const { Client } = pg;
const env = fs.readFileSync(new URL('../.env.nhost', import.meta.url), 'utf8');
const url = env.match(/DATABASE_URL=(.*)/)[1].trim();
const c = new Client({ connectionString: url });
await c.connect();
const res = await c.query("SELECT value FROM site_settings WHERE key = 'about_page'");
if (res.rows.length) {
  console.log('about_page setting exists:');
  console.log(JSON.stringify(res.rows[0].value, null, 2));
} else {
  console.log('NO about_page setting in DB — the page uses code defaults.');
}
await c.end();
