const pool = require('./server/src/db/pool');
async function test() {
  const tenantId = '33fb1b95-5b1d-441d-b25a-694ea3e1f7e0';
  const from = new Date(Date.now() - 30 * 24 * 3600 * 1000);
  const to = new Date();
  
  try {
    await pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='active') as active,
          COUNT(*) FILTER (WHERE status='completed' AND updated_at BETWEEN $2 AND $3) as completed_period,
          COALESCE(SUM(pm.paid_amount),0) as revenue_collected,
          ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(p.updated_at,NOW())-p.created_at))/86400)) as avg_duration_days
        FROM projects p
        LEFT JOIN payment_milestones pm ON pm.project_id=p.id AND pm.status='paid'
        WHERE p.tenant_id=$1 AND p.deleted_at IS NULL
      `, [tenantId, from, to]);
      console.log('Query 1 passed');
  } catch (e) { console.error('Query 1 Failed:', e.message); }

  try {
    await pool.query(`
        SELECT status, COUNT(*) as count FROM projects
        WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY status
      `, [tenantId]);
      console.log('Query 2 passed');
  } catch (e) { console.error('Query 2 Failed:', e.message); }

  try {
    await pool.query(`
        SELECT date_trunc('month', pm.due_date) as month,
          COALESCE(SUM(pm.amount),0) as planned,
          COALESCE(SUM(pm.paid_amount) FILTER (WHERE pm.status='paid'),0) as collected
        FROM payment_milestones pm
        JOIN projects p ON p.id=pm.project_id
        WHERE p.tenant_id=$1 AND pm.due_date >= NOW()-INTERVAL '6 months'
        GROUP BY month ORDER BY month
      `, [tenantId]);
      console.log('Query 3 passed');
  } catch (e) { console.error('Query 3 Failed:', e.message); }

  try {
    await pool.query(`
        SELECT p.id, p.name, p.client_name,
          COUNT(t.id) as total_tasks,
          COUNT(t.id) FILTER (WHERE t.status='done') as done_tasks,
          ROUND(100.0 * COUNT(t.id) FILTER (WHERE t.status='done') / NULLIF(COUNT(t.id),0)) as pct
        FROM projects p
        LEFT JOIN tasks t ON t.project_id=p.id AND t.deleted_at IS NULL
        WHERE p.tenant_id=$1 AND p.status='active' AND p.deleted_at IS NULL
        GROUP BY p.id ORDER BY pct ASC NULLS LAST LIMIT 8
      `, [tenantId]);
      console.log('Query 4 passed');
  } catch (e) { console.error('Query 4 Failed:', e.message); }

  try {
    await pool.query(`
        SELECT p.*, u.name as pm_name,
          EXTRACT(DAY FROM NOW()-p.target_date) as days_overdue,
          (SELECT ph.name FROM project_phases ph WHERE ph.project_id=p.id AND ph.status='in_progress' LIMIT 1) as current_phase
        FROM projects p LEFT JOIN users u ON u.id=p.pm_id
        WHERE p.tenant_id=$1 AND p.status='active'
        AND p.target_date < NOW() AND p.deleted_at IS NULL
        ORDER BY days_overdue DESC
      `, [tenantId]);
      console.log('Query 5 passed');
  } catch (e) { console.error('Query 5 Failed:', e.message); }

  process.exit(0);
}
test();
