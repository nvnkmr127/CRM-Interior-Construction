const pool = require('./server/src/db/pool');
async function test() {
  try {
    const res = await pool.query(`SELECT column_name FROM information_schema.columns WHERE table_name = 'leads'`);
    console.log(res.rows.map(r => r.column_name));
  } catch (err) {
    console.error('ERROR:', err.message);
  }
  process.exit(0);
}
test();
