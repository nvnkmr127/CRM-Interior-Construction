const pool = require('../server/src/db/pool');
async function run() {
  try {
    const res = await pool.query("SELECT s.id as session_id, s.tenant_id, u.id as user_id, u.email FROM sessions s JOIN users u ON s.user_id = u.id LIMIT 5");
    console.log("Sessions found:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
