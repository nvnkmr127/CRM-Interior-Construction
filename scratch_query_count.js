const pool = require('./server/src/db/pool');

async function test() {
  const tenantId = '5842ee7b-e84b-481e-bb3d-e4418919d050';
  try {
    const q1 = await pool.query(`SELECT COUNT(*) FROM leads WHERE tenant_id=$1 AND (1=1) AND deleted_at IS NULL`, [tenantId]);
    console.log('Q1 Rows:', q1.rows);
  } catch(e) {
    console.error('Fail:', e);
  } finally {
    await pool.end();
  }
}
test();
