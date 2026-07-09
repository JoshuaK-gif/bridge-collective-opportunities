import pg from 'pg';
import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const sqlPath = path.join(__dirname, '..', 'supabase-migration.sql');

async function run() {
  const pool = new pg.Pool({
    connectionString: 'postgresql://postgres:1mSN76gUQFSKbh3d@db.weuqfkynbmiwautzbszs.supabase.co:5432/postgres',
    ssl: { rejectUnauthorized: false },
    max: 1,
  });

  try {
    const sql = fs.readFileSync(sqlPath, 'utf8');
    const statements = sql
      .split(';')
      .map(s => s.trim())
      .filter(s => s.length > 0);

    console.log(`Executing ${statements.length} SQL statements...\n`);

    let count = 0;
    for (const stmt of statements) {
      try {
        // Skip empty comment-only blocks
        if (stmt.startsWith('--') || stmt === '') continue;
        await pool.query(stmt);
        count++;
        if (count % 10 === 0) {
          console.log(`  Executed ${count} statements...`);
        }
      } catch (err) {
        // Ignore "already exists" errors for idempotent operations
        const msg = err.message || '';
        if (msg.includes('already exists') || msg.includes('duplicate key')) {
          console.log(`  Skipped (exists): ${stmt.substring(0, 60)}...`);
        } else {
          console.error(`  ERROR on statement ${count + 1}: ${err.message}`);
          console.error(`  Statement: ${stmt.substring(0, 120)}...`);
        }
      }
    }

    console.log(`\nMigration complete. Executed ${count} statements successfully.`);

    // Verify by checking tables
    const tables = await pool.query(`
      SELECT table_name FROM information_schema.tables 
      WHERE table_schema = 'public' AND table_type = 'BASE TABLE'
      ORDER BY table_name
    `);
    console.log('\nTables in database:');
    tables.rows.forEach(r => console.log(`  - ${r.table_name}`));

    // Check RLS policies
    const policies = await pool.query(`
      SELECT tablename, policyname FROM pg_policies 
      WHERE schemaname = 'public'
      ORDER BY tablename
    `);
    console.log(`\nRLS policies: ${policies.rows.length} policies created`);
    policies.rows.forEach(r => console.log(`  - ${r.tablename}: ${r.policyname}`));

  } catch (err) {
    console.error('Migration failed:', err.message);
    process.exit(1);
  } finally {
    await pool.end();
  }
}

run();
