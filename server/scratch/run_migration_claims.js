const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

async function run() {
  try {
    console.log('Running migration 121_vendor_warranties_and_claims.sql...');
    const sqlPath = path.join(__dirname, '../migrations/121_vendor_warranties_and_claims.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log('Migration 121 executed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

run();
