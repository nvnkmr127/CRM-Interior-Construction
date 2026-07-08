const { pool } = require('./server/src/config/db');
async function check() {
  const { rows } = await pool.query("SELECT table_name, column_name, data_type FROM information_schema.columns WHERE table_name IN ('activities', 'audit_logs')");
  console.log(JSON.stringify(rows, null, 2));
  process.exit(0);
}
check();
