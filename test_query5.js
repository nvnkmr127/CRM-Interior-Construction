const pool = require('./server/src/db/pool');
async function test() {
  try {
    const res = await pool.query(`SELECT * FROM lead_activities LIMIT 1`);
    console.log(res.rows);
  } catch (err) {
    console.error('ERROR:', err.message);
  }
  process.exit(0);
}
test();
