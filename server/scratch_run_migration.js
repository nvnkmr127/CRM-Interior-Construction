const fs = require('fs');
const path = require('path');
const { pool } = require('./src/config/db');

async function run() {
  try {
    const file = '158_project_site_visits.sql';
    const sqlPath = path.join(__dirname, 'migrations', file);
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log(`Running migration: ${file}...`);
    await pool.query(sql);
    console.log('Migration executed successfully!');
  } catch (err) {
    console.error('Migration execution failed:', err);
  } finally {
    await pool.end();
  }
}

run();
