const pool = require('./server/src/db/pool');
async function run() {
  try {
    const res = await pool.query('UPDATE projects SET deleted_at = NOW() WHERE deleted_at IS NULL');
    console.log('Successfully soft-deleted projects count:', res.rowCount);
  } catch (err) {
    console.error('Error soft-deleting projects:', err);
  } finally {
    await pool.end();
  }
}
run();
