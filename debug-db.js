const pool = require('./server/src/db/pool');

async function run() {
  try {
    const res = await pool.query('SELECT id, name, status, deleted_at FROM projects WHERE deleted_at IS NOT NULL LIMIT 5');
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
    if (pool.readPool) {
      pool.readPool.end();
    }
  }
}
run();
