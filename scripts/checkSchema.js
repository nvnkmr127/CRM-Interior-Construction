const { pool } = require('./server/src/config/db');

async function check() {
  const { rows } = await pool.query("SELECT column_name, data_type FROM information_schema.columns WHERE table_name = 'projects'");
  console.log(rows.filter(r => r.column_name.includes('designer')));
  process.exit(0);
}
check();
