const { Pool } = require('pg');
const fs = require('fs');
const pool = new Pool({ connectionString: 'postgres://postgres:postgres@localhost:5432/crm_interior' }); 

async function check() {
  try {
    const res = await pool.query(`
      SELECT l.id, l.assignee_id, u.id as u_id, u.name, l.assignee_name as l_assignee_name
      FROM leads l
      LEFT JOIN users u ON l.assignee_id = u.id
      LIMIT 5
    `);
    fs.writeFileSync('db_out.json', JSON.stringify(res.rows, null, 2));
  } catch (e) {
    fs.writeFileSync('db_out.json', JSON.stringify({ error: e.message }));
  } finally {
    pool.end();
  }
}
check();
