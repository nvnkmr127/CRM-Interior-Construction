const fs = require('fs');
const path = require('path');
require('dotenv').config({ path: path.resolve(__dirname, '../../.env') });
const pool = require('../src/config/db');

async function run() {
  try {
    const sqlPath = path.resolve(__dirname, '../migrations/146_design_stage_workflow.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    console.log('Running migration 146...');
    await pool.query(sql);
    console.log('Migration 146 ran successfully!');
  } catch (err) {
    console.error('Error running migration 146:', err);
  } finally {
    await pool.end();
  }
}

run();
