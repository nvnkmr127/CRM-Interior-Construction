const pool = require('./server/src/db/pool');
async function test() {
  const res = await pool.query(`SELECT DISTINCT status FROM users`);
  console.log('Statuses:', res.rows.map(r=>r.status));
  process.exit(0);
}
test();
