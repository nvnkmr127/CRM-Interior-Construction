const pool = require('../src/db/pool');

async function run() {
  console.log('Running migration 049...');
  try {
    await pool.query(`
      ALTER TABLE leads
      ADD COLUMN IF NOT EXISTS suggested_followup_at TIMESTAMP WITH TIME ZONE;
    `);
    console.log('Migration 049 completed successfully.');
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}

run();
