const pool = require('../src/db/pool');
const { readPool } = pool;

async function run() {
  try {
    const visits = await readPool.query(`
      SELECT id, scheduled_at, status, tenant_id, lead_id, assignee_id
      FROM site_visits
      ORDER BY created_at DESC
      LIMIT 5
    `);
    console.log("Latest Site Visits:", visits.rows);

    const checkTime = await readPool.query(`
      SELECT NOW(), CURRENT_DATE, CURRENT_TIMESTAMP
    `);
    console.log("Database times:", checkTime.rows);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

run();
