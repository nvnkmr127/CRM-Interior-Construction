const pool = require('./src/db/pool');
const fs = require('fs');
const path = require('path');

async function run() {
  const sql = fs.readFileSync(path.join(__dirname, 'migrations', '024_user_permissions.sql'), 'utf8');
  await pool.query(sql);
  console.log('Migration 024 executed');
  process.exit(0);
}

run();
