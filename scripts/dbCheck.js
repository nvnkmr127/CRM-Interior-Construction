const { pool } = require('./server/src/config/db');

async function test() {
  const { rows } = await pool.query('SELECT id, designer_ids, lead_designer_ids, qc_engineer_ids FROM projects LIMIT 1');
  const project = rows[0];
  console.log('DB Project Arrays:', project);

  if (project) {
    const query = `
      SELECT 
        (SELECT string_agg(u.name, ', ') FROM users u WHERE u.id = ANY(p.qc_engineer_ids)) as qc_engineer_name
      FROM projects p WHERE id = $1
    `;
    const { rows: nameRows } = await pool.query(query, [project.id]);
    console.log('DB Project Names:', nameRows[0]);
  }
  process.exit(0);
}
test();
