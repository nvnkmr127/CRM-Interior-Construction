require('dotenv').config({ path: require('path').resolve(__dirname, '../../.env') });
const fs = require('fs');
const path = require('path');
const pool = require('../src/config/db');

async function run() {
  try {
    const file = '137_production_site_coordination.sql';
    const sqlPath = path.join(__dirname, '../migrations', file);
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
