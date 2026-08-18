// Read-only inspection of the Nhost Postgres database.
// Usage: node scripts/nhost-inspect.mjs
import dotenv from 'dotenv';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: path.join(__dirname, '..', '.env.nhost'), override: true });
process.env.USE_PGLITE = 'false';

const { default: db } = await import('../lib/db.js');

try {
  const info = await db.query(`
    SELECT current_database() AS db, current_user AS user, version() AS version
  `);
  console.log('✅ Connected to Nhost Postgres');
  console.log('   database:', info.rows[0].db);
  console.log('   user:    ', info.rows[0].user);

  const tables = await db.query(`
    SELECT table_name
    FROM information_schema.tables
    WHERE table_schema = 'public'
      AND table_type = 'BASE TABLE'
    ORDER BY table_name
  `);

  console.log(`\n📋 Tables (${tables.rows.length}):`);
  for (const t of tables.rows) {
    const count = await db.query(
      `SELECT count(*)::int AS n FROM "${t.table_name.replace(/"/g, '""')}"`
    );
    console.log(`   - ${t.table_name}: ${count.rows[0].n} rows`);
  }

  // Auth users live in Nhost's auth schema
  try {
    const authUsers = await db.query(
      `SELECT count(*)::int AS n FROM auth.users`
    );
    console.log(`\n🔐 auth.users: ${authUsers.rows[0].n} users`);
  } catch {
    console.log('\n🔐 auth.users: not accessible (no permission)');
  }
} catch (err) {
  console.error('❌ Failed to connect:', err.message);
  process.exitCode = 1;
} finally {
  await db.end();
}
