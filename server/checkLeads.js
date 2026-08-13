const { Pool } = require('pg');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/crm_db' });
async function run() {
  try {
    const c1 = await pool.query('SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL');
    console.log('Total leads:', c1.rows[0].count);
    const c2 = await pool.query('SELECT COUNT(*) FROM leads WHERE deleted_at IS NULL AND (status NOT IN (\'converted\', \'won\', \'lost\', \'archived\') OR status IS NULL)');
    console.log('Active leads:', c2.rows[0].count);
    const c3 = await pool.query('SELECT status, COUNT(*) FROM leads GROUP BY status');
    console.log('By status:', c3.rows);
  } catch (err) {
    console.error(err);
  } finally {
    pool.end();
  }
}
run();
