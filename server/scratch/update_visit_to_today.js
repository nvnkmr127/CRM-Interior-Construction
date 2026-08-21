const pool = require('../src/db/pool');
const { readPool } = pool;

async function run() {
  try {
    const res = await readPool.query(`
      UPDATE site_visits 
      SET scheduled_at = '2026-08-21 18:00:00Z'
      WHERE id = '3a9c3e4a-6224-4757-97b0-cddd993315ae'
      RETURNING *
    `);
    console.log("Updated Site Visit:", res.rows);
  } catch (error) {
    console.error("Error:", error);
  } finally {
    await pool.end();
  }
}

run();
