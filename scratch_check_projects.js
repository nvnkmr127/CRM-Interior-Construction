const pool = require('./server/src/db/pool');
async function run() {
  try {
    const res = await pool.query('SELECT id, name, tenant_id, deleted_at FROM projects');
    console.log('Projects:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}
run();
