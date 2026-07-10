import 'dotenv/config';
import { PGlite } from '@electric-sql/pglite';

const db = new PGlite({ dataDir: './pglite-data' });

const apiKey = process.env.GEMINI_API_KEY || '';
const config = { api_key: apiKey, provider: 'gemini', model: 'gemini-2.0-flash', enabled: !!apiKey };

await db.query(
  "INSERT INTO site_settings (key, value, updated_at) VALUES ('openai_config', $1, now()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()",
  [JSON.stringify(config)]
);

console.log('Reverted to Gemini (set GEMINI_API_KEY in .env)');
await db.close();
