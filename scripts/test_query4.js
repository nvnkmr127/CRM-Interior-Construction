const pool = require('./server/src/db/pool');
async function test() {
  const res = await pool.query("SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON u.role_id = r.id LIMIT 1");
  console.log(res.rows[0]);
  process.exit(0);
}
test();
