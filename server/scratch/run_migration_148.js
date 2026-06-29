const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const pool = require('../src/config/db');

async function run() {
  try {
    const sqlPath = path.resolve(__dirname, '../migrations/148_layout_tracking_and_mep_checklist.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Running migration 148...');
    await pool.query(sql);
    console.log('Migration 148 ran successfully!');
  } catch (err) {
    console.error('Error running migration 148:', err);
  } finally {
    await pool.end();
  }
}

run();
