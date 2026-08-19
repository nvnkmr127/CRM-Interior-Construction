const pool = require('../server/src/db/pool');
async function run() {
  try {
    await pool.query("UPDATE leads SET deleted_at = NULL WHERE id = '9523029d-a3b2-4b53-9f4a-f7bd8c103280'");
    console.log("Lead successfully restored!");
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
