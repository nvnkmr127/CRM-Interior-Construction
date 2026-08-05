const pool = require('./pool');
const logger = require('../utils/logger');
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
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
}
run();