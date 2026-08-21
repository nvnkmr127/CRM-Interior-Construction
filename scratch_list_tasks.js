const pool = require('./server/src/config/db');

async function run() {
  try {
    const res = await pool.query('SELECT id, title, assignee_id, status, deleted_at FROM tasks');
    console.log(`Found ${res.rows.length} tasks:`);
    console.log(res.rows);
  } catch (err) {
    console.error('Error listing tasks:', err);
  } finally {
    await pool.end();
  }
}

run();
