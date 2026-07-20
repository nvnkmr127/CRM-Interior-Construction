const fs = require('fs');
const { Pool } = require('pg');
require('dotenv').config({ path: 'server/.env' });
const pool = new Pool({ connectionString: process.env.DATABASE_URL });

async function run() {
  try {
    const sql = fs.readFileSync('server/migrations/006_financial_approval_attachments.sql', 'utf8');
    await pool.query(sql);
    console.log('Migration applied successfully');
  } catch(e) {
    console.error(e);
  } finally {
    pool.end();
  }
}
run();
