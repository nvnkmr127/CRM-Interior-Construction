require('dotenv').config({ path: require('path').join(__dirname, '../server/.env') });
const pool = require('../server/src/db/pool');

async function checkTasks() {
  try {
    const { rows } = await pool.query('SELECT id, title, status, due_date, tenant_id, deleted_at FROM tasks');
    console.log('Total tasks in DB:', rows.length);
    console.dir(rows, { depth: null });
  } catch (err) {
    console.error('Error querying tasks:', err);
  } process.exit(0);
}

checkTasks();
