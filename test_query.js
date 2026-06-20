const pool = require('./server/src/db/pool');
async function test() {
  try {
    const res = await pool.query(`
      SELECT p.*,
        pm.first_name || ' ' || pm.last_name as pm_name,
        d.first_name || ' ' || d.last_name as designer_name,
        (SELECT count(id)::int FROM project_phases WHERE project_id = p.id AND tenant_id = 'demo') as phase_count,
        (SELECT count(id)::int FROM project_phases WHERE project_id = p.id AND tenant_id = 'demo' AND status = 'completed') as completed_phase_count,
        (SELECT count(id)::int FROM tasks WHERE project_id = p.id AND tenant_id = 'demo' AND deleted_at IS NULL) as total_tasks,
        (SELECT count(id)::int FROM tasks WHERE project_id = p.id AND tenant_id = 'demo' AND deleted_at IS NULL AND status = 'done') as completed_tasks
      FROM projects p
      LEFT JOIN users pm ON p.pm_id = pm.id
      LEFT JOIN users d ON p.designer_id = d.id
      WHERE p.tenant_id = 'demo' AND p.deleted_at IS NULL
      ORDER BY p.created_at DESC
      LIMIT 20 OFFSET 0
    `);
    console.log('Query successful, returned rows:', res.rows.length);
  } catch (err) {
    console.error('ERROR:', err.message);
  }
  process.exit(0);
}
test();
