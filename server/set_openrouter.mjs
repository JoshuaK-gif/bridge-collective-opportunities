import { PGlite } from '@electric-sql/pglite';

const db = new PGlite({ dataDir: './pglite-data' });

const apiKey = process.env.OPENROUTER_API_KEY || '';
if (!apiKey) {
  console.error('OPENROUTER_API_KEY is not set — add it to server/.env before running this script.');
  process.exit(1);
}

const config = {
  api_key: apiKey,
  provider: 'openrouter',
  model: 'openai/gpt-4o-mini',
  enabled: true
};

await db.query(
  "INSERT INTO site_settings (key, value, updated_at) VALUES ('openai_config', $1, now()) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()",
  [JSON.stringify(config)]
);

console.log('Switched to OpenRouter');
await db.close();
