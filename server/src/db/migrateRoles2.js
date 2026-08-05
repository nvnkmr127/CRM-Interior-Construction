const { pool } = require('../config/db');
const logger = require('../utils/logger');

async function migrate() {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const cols = ['designer', 'lead_designer', 'junior_designer', 'site_engineer', 'qc_engineer', 'site_supervisor', 'crm_executive', 'procurement_officer'];
    
    for (const col of cols) {
      await client.query(`ALTER TABLE projects ADD COLUMN IF NOT EXISTS ${col}_ids uuid[] DEFAULT '{}'`);
      await client.query(`UPDATE projects SET ${col}_ids = ARRAY[${col}_id] WHERE ${col}_id IS NOT NULL`);
    }
    
    await client.query('COMMIT');
    console.log('Migration successful');
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('Migration failed:', error);
  } finally {
    client.release();
    process.exit(0);
  }
}
migrate();
