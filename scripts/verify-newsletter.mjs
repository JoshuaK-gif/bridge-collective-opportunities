// Verify the newsletter batching loop against the live Nhost DB.
// Temporarily inserts 3 test subscribers + a dummy SMTP config (fails fast),
// runs sendNewsletter in batches of 2, checks the `done` flag, then cleans up.
import { Client } from 'pg';
import { sendNewsletter } from '../functions/_shared/newsletter.js';

const TEST_EMAILS = ['test-a@example.com', 'test-b@example.com', 'test-c@example.com'];

async function main() {
  const client = new Client({
    connectionString: process.env.DATABASE_URL,
    ssl: { rejectUnauthorized: false },
  });
  await client.connect();

  // Save existing smtp_config to restore later
  const existing = await client.query("SELECT value FROM site_settings WHERE key = 'smtp_config'");
  const oldSmtp = existing.rows.length ? existing.rows[0].value : null;

  try {
    // 1. Insert test subscribers (idempotent)
    for (const email of TEST_EMAILS) {
      await client.query(
        `INSERT INTO subscribers (email, is_active) VALUES ($1, true)
         ON CONFLICT (email) DO UPDATE SET is_active = true, unsubscribed_at = NULL`,
        [email]
      );
    }
    const active = await client.query("SELECT count(*) FROM subscribers WHERE is_active = true AND unsubscribed_at IS NULL");
    console.log(`Active subscribers now: ${active.rows[0].count}`);

    // 2. Dummy SMTP config — unreachable host so sends fail fast instead of skipping
    await client.query(
      "INSERT INTO site_settings (key, value) VALUES ('smtp_config', $1) ON CONFLICT (key) DO UPDATE SET value = $1, updated_at = now()",
      [JSON.stringify({ host: '127.0.0.1', port: 1, secure: false, user: '', pass: '' })]
    );

    // 3. Run batches like the cron workflow would
    let offset = 0;
    let iterations = 0;
    while (iterations < 10) {
      const result = await sendNewsletter({ batchSize: 2, offset });
      console.log(`batch offset=${offset} ->`, JSON.stringify(result));
      if (result.done || result.skipped) break;
      if ((result.total || 0) < 2) break;
      offset += 2;
      iterations++;
    }
  } finally {
    // 4. Cleanup
    await client.query("DELETE FROM subscribers WHERE email = ANY($1::text[])", [TEST_EMAILS]);
    if (oldSmtp) {
      await client.query("UPDATE site_settings SET value = $1, updated_at = now() WHERE key = 'smtp_config'", [oldSmtp]);
    } else {
      await client.query("DELETE FROM site_settings WHERE key = 'smtp_config'");
    }
    await client.end();
  }
}

main().then(() => console.log('NEWSLETTER VERIFICATION DONE')).catch(e => { console.error('VERIFY FAILED:', e.message); process.exit(1); });
