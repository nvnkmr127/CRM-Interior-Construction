const fs = require('fs');
const path = require('path');
const pool = require('../src/db/pool');

async function run() {
  try {
    console.log('Running migration 119_warranty_module.sql...');
    const sqlPath119 = path.join(__dirname, '../migrations/119_warranty_module.sql');
    const sql119 = fs.readFileSync(sqlPath119, 'utf8');
    await pool.query(sql119);
    console.log('Migration 119 executed successfully!');

    console.log('Running migration 120_amc_module.sql...');
    const sqlPath120 = path.join(__dirname, '../migrations/120_amc_module.sql');
    const sql120 = fs.readFileSync(sqlPath120, 'utf8');
    await pool.query(sql120);
    console.log('Migration 120 executed successfully!');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    await pool.end();
  }
}

run();
