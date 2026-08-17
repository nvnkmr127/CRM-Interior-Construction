const pool = require('./src/db/pool');

async function check() {
  try {
    const { rows } = await pool.query('SELECT * FROM audit_logs ORDER BY created_at DESC LIMIT 5');
    console.log('--- RECENT AUDIT LOGS ---');
    console.log(JSON.stringify(rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
    await pool.readPool.end();
  }
}

check();
