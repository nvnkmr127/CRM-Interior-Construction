const { pool } = require('./server/src/config/db');
async function run() {
  const { rows } = await pool.query('SELECT id, name, email FROM users');
  console.log(rows);
  process.exit(0);
}
run();
