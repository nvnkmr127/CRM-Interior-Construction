const pool = require('./server/src/db/pool');
async function test() {
  const tenantId = '33fb1b95-5b1d-441d-b25a-694ea3e1f7e0';
  const userId = '73c6c8ec-6a62-486a-9cce-844e145bbf8c';
  
  try {
    await pool.query(`SELECT COUNT(*) FROM leads WHERE tenant_id=$1 AND status='active' AND deleted_at IS NULL`, [tenantId]);
    console.log('Q1 ok');
  } catch (e) { console.error('Q1 fail', e.message); }

  try {
    await pool.query(`
      SELECT COUNT(*) FROM leads
      WHERE tenant_id=$1 AND status='active' AND deleted_at IS NULL
      AND created_at >= NOW() - INTERVAL '14 days'
      AND created_at < NOW() - INTERVAL '7 days'
    `, [tenantId]);
    console.log('Q5 ok');
  } catch(e) { console.error('Q5 fail', e.message); }

  process.exit(0);
}
test();
