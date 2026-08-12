import 'dotenv/config';
import pool from './lib/db.js';

const sql = "ALTER TABLE opportunities ADD COLUMN IF NOT EXISTS structured_data JSONB DEFAULT '{}'::jsonb";
await pool.query(sql);
console.log('Column structured_data added successfully');
const check = await pool.query("SELECT column_name FROM information_schema.columns WHERE table_name='opportunities' AND column_name='structured_data'");
console.log('Verified:', check.rows.length > 0 ? 'EXISTS' : 'MISSING');
process.exit(0);
