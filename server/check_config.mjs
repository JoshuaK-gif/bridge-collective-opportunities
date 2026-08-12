import { PGlite } from '@electric-sql/pglite';

const db = new PGlite({ dataDir: './pglite-data' });
const r = await db.query("SELECT value FROM site_settings WHERE key = 'openai_config'");
const raw = r.rows[0].value;
const cfg = typeof raw === 'string' ? JSON.parse(raw) : raw;
console.log('provider:', cfg.provider);
console.log('model:', cfg.model);
console.log('enabled:', cfg.enabled);
console.log('api_key[:20]:', cfg.api_key ? cfg.api_key.substring(0, 20) + '...' : 'none');
await db.close();
