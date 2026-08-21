const pool = require('./server/src/db/pool');

async function run() {
  try {
    const res = await pool.query(`
      SELECT t.title, u.name as assignee_name, t.status, t.due_date
      FROM tasks t
      JOIN users u ON t.assignee_id = u.id
      WHERE t.deleted_at IS NULL AND t.status != 'done' AND t.due_date::date = CURRENT_DATE
      ORDER BY assignee_name
    `);
    console.log(JSON.stringify(res.rows, null, 2));
  } catch (err) {
    console.error(err);
  } finally {
    await pool.end();
  }
}

run();
