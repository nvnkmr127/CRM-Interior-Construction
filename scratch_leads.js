const pool = require('./server/src/db/pool');

async function run() {
  try {
    const res = await pool.query('SELECT id, name, tenant_id, assignee_id, deleted_at, status FROM leads');
    console.log('Leads count:', res.rows.length);
    console.log('Leads:', res.rows);
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
