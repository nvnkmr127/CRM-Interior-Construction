const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

async function run() {
  try {
    const sqlPath = path.join(__dirname, '../migrations/126_project_closure_checklist.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Running migration 126...');
    await pool.query(sql);
    console.log('Migration executed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

run();
