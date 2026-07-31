const pool = require('./src/db/pool');
async function run() {
  try {
    const { rows } = await pool.query('SELECT id, name, email, role_id, status, last_login_at as "lastActive" FROM users WHERE deleted_at IS NULL LIMIT 1');
    console.log('Success:', rows);
  } catch (err) {
    console.error('Error:', err.message);
  } finally {
    pool.end();
  }
}
run();
