const pool = require('./src/config/db');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const sql = fs.readFileSync(path.join(__dirname, 'migrations/031_financial_approval_withdrawn.sql'), 'utf8');
    await pool.query(sql);
    console.log('Migration 031 applied successfully!');
    process.exit(0);
  } catch (err) {
    console.error('Migration failed:', err);
    process.exit(1);
  }
}

run();
