const pool = require('../server/src/db/pool');
async function run() {
  try {
    const res = await pool.query("SELECT * FROM leads WHERE id = '9523029d-a3b2-4b53-9f4a-f7bd8c103280'");
    console.log("Lead:", res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
