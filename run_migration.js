const fs = require('fs');
const path = require('path');
const pool = require('./server/src/db/pool');

async function runMigration() {
  try {
    const migrations = [
      '031_lead_qualification.sql',
      '032_lead_scoring_and_pipeline.sql',
      '033_site_visits_and_ai_summaries.sql',
      '034_sla_automation.sql'
    ];
    for (const file of migrations) {
      const sqlPath = path.join(__dirname, 'server/migrations', file);
      const sql = fs.readFileSync(sqlPath, 'utf8');
      await pool.query(sql);
      console.log(`Migration ${file} completed successfully`);
    }
  } catch (err) {
    console.error('Migration failed:', err);
  } finally {
    process.exit(0);
  }
}

runMigration();
