const pool = require('../src/db/pool');
const { readPool } = pool;

async function run() {
  try {
    const visits = await readPool.query(`
      SELECT id, tenant_id, lead_id, assignee_id, scheduled_at, status, notes, client_invited
      FROM site_visits
      LIMIT 10
    `);
    console.log("All Site Visits in database:", visits.rows);

    const counts = await readPool.query(`
      SELECT status, COUNT(*) as count
      FROM site_visits
      GROUP BY status
    `);
    console.log("Site Visits counts by status:", counts.rows);

    const todayDate = new Date().toISOString().split('T')[0];
    console.log("Today date check (JS ISO):", todayDate);

    const todayVisits = await readPool.query(`
      SELECT id, scheduled_at, scheduled_at::date, status
      FROM site_visits
      WHERE scheduled_at::date = CURRENT_DATE
    `);
    console.log("Site Visits scheduled for CURRENT_DATE:", todayVisits.rows);

    const checkNow = await readPool.query(`
      SELECT CURRENT_DATE, NOW()
    `);
    console.log("Database CURRENT_DATE and NOW():", checkNow.rows);

  } catch (error) {
    console.error("Error checking site visits:", error);
  } finally {
    await pool.end();
  }
}

run();
