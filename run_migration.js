const fs = require('fs');
const path = require('path');
const pool = require('./server/src/db/pool');

async function runMigration() {
  try {
    const sqlPath = path.join(__dirname, 'server/migrations/034_sla_automation.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log('Migration 034 completed successfully');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}

runMigration();
