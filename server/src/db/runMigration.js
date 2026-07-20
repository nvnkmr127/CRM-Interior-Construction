const pool = require('./pool');
async function run() {
  try {
    await pool.query(`
      ALTER TABLE financial_approvals 
      ADD COLUMN IF NOT EXISTS current_stage INTEGER DEFAULT 1, 
      ADD COLUMN IF NOT EXISTS total_stages INTEGER DEFAULT 1, 
      ADD COLUMN IF NOT EXISTS approval_chain JSONB DEFAULT '[]'::jsonb;
    `);
    console.log('Schema updated');
    process.exit(0);
  } catch (err) {
    console.error(err);
    process.exit(1);
  }
}
run();