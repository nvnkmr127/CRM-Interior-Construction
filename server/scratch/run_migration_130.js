const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

async function run() {
  try {
    const sqlPath = path.join(__dirname, '../migrations/130_project_pause_and_cancellation.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Running migration 130...');
    await pool.query(sql);
    console.log('Migration executed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

run();
