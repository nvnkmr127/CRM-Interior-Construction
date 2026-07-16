const pool = require('./server/src/db/pool');
async function test() {
  const res = await pool.query("SELECT * FROM project_templates LIMIT 1");
  console.log(res.rows[0]);
  process.exit(0);
}
test();
