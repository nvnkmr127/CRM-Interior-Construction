const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

async function run() {
  try {
    const sqlPath = path.join(__dirname, '../migrations/117_handover_documentation.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Running migration 117...');
    await pool.query(sql);
    console.log('Migration executed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

run();
