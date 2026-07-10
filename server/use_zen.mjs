import 'dotenv/config';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite({ dataDir: './pglite-data' });

const config = { provider: 'opencodezen', model: 'opencode/deepseek-v4-flash-free', enabled: true };

await db.query(
  "INSERT INTO site_settings (key, value, updated_at) VALUES ('openai_config', $1, now()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()",
  [JSON.stringify(config)]
);

console.log('Switched to OpenCode Zen');
await db.close();
