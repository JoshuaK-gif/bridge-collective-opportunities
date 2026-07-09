import { execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';
import fs from 'fs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const BACKUP_DIR = path.join(__dirname, '..', 'backups');

if (!fs.existsSync(BACKUP_DIR)) {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
}

const dbUrl = process.env.DATABASE_URL;
if (!dbUrl) {
  console.error('DATABASE_URL not set');
  process.exit(1);
}

const timestamp = new Date().toISOString().replace(/[:.]/g, '-');
const filename = path.join(BACKUP_DIR, `backup-${timestamp}.sql`);

try {
  execSync(`pg_dump "${dbUrl}" > "${filename}"`, { stdio: 'inherit' });
  console.log(`Backup saved: ${filename}`);
} catch (err) {
  console.error('Backup failed:', err.message);
  process.exit(1);
}
