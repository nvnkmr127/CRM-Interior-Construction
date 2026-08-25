const pool = require('./server/src/db/pool');

async function run() {
  try {
    const projectId = '3223cfe7-5279-4796-9330-212fcf110d0b';
    console.log('Querying project status and details...');
    const projectRes = await pool.query('SELECT name, status, created_at FROM projects WHERE id = $1', [projectId]);
    console.log('Project details:', projectRes.rows);

    console.log('\nQuerying documents in database...');
    const docsRes = await pool.query('SELECT * FROM documents WHERE project_id = $1', [projectId]);
    console.log('Documents:', docsRes.rows);
  } catch (error) {
    console.error('Error:', error);
  } finally {
    await pool.end();
  }
}

run();
