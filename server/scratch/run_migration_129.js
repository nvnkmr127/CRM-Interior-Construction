const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

async function run() {
  try {
    const sqlPath = path.join(__dirname, '../migrations/129_handover_internal_authorization.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Running migration 129...');
    await pool.query(sql);
    console.log('Migration executed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

run();
