const pool = require('./server/src/db/pool');
async function check() {
  try {
    const res = await pool.query("SELECT * FROM roles WHERE name = 'Admin'");
    console.log('Admin roles in DB:', JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
check();
