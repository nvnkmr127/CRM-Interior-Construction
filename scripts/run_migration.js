process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
const fs = require('fs');
const path = require('path');
const pool = require('./server/src/db/pool');

async function runMigration() {
  try {
    const migrations = [
      '165_site_material_usages.sql'
    ];
    for (const file of migrations) {
      const sqlPath = path.join(__dirname, 'server/migrations', file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await pool.query(sql);
      console.log(`Migration ${file} completed successfully`);
    }
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}

runMigration();
