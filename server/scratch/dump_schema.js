const pool = require('../src/config/db');
async function run() {
  const r = await pool.query(`SELECT table_name, column_name FROM information_schema.columns WHERE table_name IN ('leads', 'projects')`);
  console.log(r.rows);
  process.exit(0);
}
run();
