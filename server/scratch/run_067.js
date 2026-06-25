const pool = require('../src/db/pool');
const fs = require('fs');
const path = require('path');

async function run() {
  try {
    const sqlPath = path.join(__dirname, '../migrations/067_add_payment_terms_to_projects.sql');
    const sql = fs.readFileSync(sqlPath, 'utf8');
    await pool.query(sql);
    console.log("Migration 067 ran successfully");
  } catch (err) {
    console.error("Migration 067 failed:", err.message);
  } finally {
    process.exit(0);
  }
}
run();
