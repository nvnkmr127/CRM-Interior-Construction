const pool = require('./src/db/pool');
const fs = require('fs');
const path = require('path');
async function run() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'migrations/002_approval_matrix.sql'), 'utf-8');
    await pool.query(sql);
    console.log('Migration 002 applied');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();
