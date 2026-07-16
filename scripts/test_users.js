const pool = require('./server/src/db/pool');
async function test() {
  try {
    const { rows } = await pool.query(`
      SELECT u.*, r.name as role_name, r.permissions
      FROM users u LEFT JOIN roles r ON r.id=u.role_id
      WHERE u.tenant_id=$1 AND u.deleted_at IS NULL
      ORDER BY u.created_at DESC
      LIMIT 10 OFFSET 0
    `, ['33fb1b95-5b1d-441d-b25a-694ea3e1f7e0']);
    console.log('SUCCESS:', rows.length);
  } catch (e) {
    console.error('FAIL:', e.message);
  }
  process.exit(0);
}
test();
