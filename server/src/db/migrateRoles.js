const pool = require('./pool').pool || require('./pool');
const logger = require('../utils/logger');

async function run() {
  const p = pool.query ? pool : pool.pool;
  const oldCols = [
    'designer_id', 'lead_designer_id', 'junior_designer_id', 
    'site_engineer_id', 'qc_engineer_id', 'site_supervisor_id', 
    'crm_executive_id', 'procurement_officer_id'
  ];

  try {
    for (const oldCol of oldCols) {
      const col = oldCol + 's';
      const fkName = `projects_${oldCol}_fkey`;
      await p.query(`ALTER TABLE projects DROP CONSTRAINT IF EXISTS ${fkName};`).catch(error =>console.log(error.message));
      await p.query(`ALTER TABLE projects ALTER COLUMN ${col} TYPE uuid[] USING CASE WHEN ${col} IS NOT NULL THEN ARRAY[${col}] ELSE NULL END;`).catch(error =>console.log(error.message));
    }
    console.log("Migration successful");
    process.exit(0);
  } catch (error) {
    logger.error(error);
    process.exit(1);
  }
}
run();
