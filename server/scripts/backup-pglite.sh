#!/bin/bash
TIMESTAMP=$(date +%Y%m%d-%H%M%S)
BACKUP_DIR=/home/ubuntu/backups
mkdir -p $BACKUP_DIR

tar -czf $BACKUP_DIR/pglite-$TIMESTAMP.tar.gz -C /home/ubuntu/app/server pglite-data

cd /home/ubuntu/app/server && node -e "
import { PGlite } from '@electric-sql/pglite';
import fs from 'fs';
const pg = new PGlite({ dataDir: './pglite-data' });
const tables = ['users','opportunities','site_settings','subscribers','messages','categories','applications','saved_opportunities','reviews','list_items','audit_log','news','resumes','packages'];
let sql = '';
for (const t of tables) {
  try {
    const res = await pg.query('SELECT * FROM \"' + t + '\"');
    if (res.rows.length) {
      for (const row of res.rows) {
        const cols = Object.keys(row).map(c => '\"' + c + '\"').join(',');
        const vals = Object.values(row).map(v => v === null ? 'NULL' : \"'\" + String(v).replace(/'/g, \"''\") + \"'\").join(',');
        sql += 'INSERT INTO \"' + t + '\" (' + cols + ') VALUES (' + vals + ');\n';
      }
    }
  } catch(e) {
    fs.appendFileSync('/tmp/backup-errors.log', String(e) + '\n');
  }
}
fs.writeFileSync('$BACKUP_DIR/dump-$TIMESTAMP.sql', sql);
console.log('SQL dump saved:', '$BACKUP_DIR/dump-$TIMESTAMP.sql');
pg.close();
"

find $BACKUP_DIR -name 'pglite-*.tar.gz' -mtime +7 -delete
find $BACKUP_DIR -name 'dump-*.sql' -mtime +7 -delete
echo "Backup completed: $TIMESTAMP"
