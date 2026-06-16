const express = require('express');
const authenticate = require('../middleware/authenticate');
const pool = require('../config/db');
const { success, fail } = require('../utils/response');

const router = express.Router();
router.use(authenticate);

/**
 * GET /api/dashboard/stats
 * Aggregated counts for the dashboard KPI cards.
 */
router.get('/stats', async (req, res) => {
  try {
    const { tenantId } = req;
    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString();
    const today = now.toISOString().split('T')[0];

    const [leadsRes, revenueRes, projectsRes, tasksRes] = await Promise.all([
      // Active leads (not won/lost)
      pool.query(
        `SELECT COUNT(id)::int as active,
                COUNT(id) FILTER (WHERE status = 'won' AND updated_at >= $2)::int as won_month
         FROM leads WHERE tenant_id = $1 AND deleted_at IS NULL`,
        [tenantId, startOfMonth]
      ),
      // Revenue this month (paid payment milestones)
      pool.query(
        `SELECT COALESCE(SUM(paid_amount), 0) as revenue_month
         FROM payment_milestones
         WHERE tenant_id = $1 AND status = 'paid' AND paid_date >= $2`,
        [tenantId, startOfMonth]
      ),
      // Active projects
      pool.query(
        `SELECT COUNT(id)::int as active,
                COUNT(id) FILTER (WHERE status != 'completed' AND target_date < $2)::int as overdue
         FROM projects WHERE tenant_id = $1 AND deleted_at IS NULL AND status NOT IN ('completed','cancelled')`,
        [tenantId, today]
      ),
      // Tasks due today / overdue (for current user)
      pool.query(
        `SELECT COUNT(id)::int as due_today,
                COUNT(id) FILTER (WHERE due_date < $2 AND status != 'done')::int as overdue
         FROM tasks
         WHERE tenant_id = $1 AND deleted_at IS NULL
           AND status != 'done'
           AND due_date <= $2`,
        [tenantId, today]
      ),
    ]);

    return success(res, {
      activeLeads:    { val: leadsRes.rows[0].active,    trend: 0 },
      wonMonth:       { val: Number(revenueRes.rows[0].revenue_month), trend: 0 },
      activeProjects: { val: projectsRes.rows[0].active, overdue: projectsRes.rows[0].overdue },
      tasksDueToday:  { val: tasksRes.rows[0].due_today, overdue: tasksRes.rows[0].overdue },
    });
  } catch (err) {
    console.error('[Dashboard] Stats error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to load dashboard stats', 500);
  }
});

/**
 * GET /api/dashboard/activity
 * Recent audit log entries for the activity feed.
 */
router.get('/activity', async (req, res) => {
  try {
    const { tenantId } = req;
    const { rows } = await pool.query(
      `SELECT al.id, al.action, al.entity, al.entity_id, al.created_at,
              u.name as user_name
       FROM audit_logs al
       LEFT JOIN users u ON u.id = al.user_id
       WHERE al.tenant_id = $1
       ORDER BY al.created_at DESC
       LIMIT 10`,
      [tenantId]
    );
    return success(res, rows);
  } catch (err) {
    console.error('[Dashboard] Activity error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to load activity feed', 500);
  }
});

/**
 * GET /api/dashboard/payments-due
 * Upcoming and overdue payment milestones.
 */
router.get('/payments-due', async (req, res) => {
  try {
    const { tenantId } = req;
    const { rows } = await pool.query(
      `SELECT pm.id, pm.title, pm.amount, pm.due_date, pm.status,
              p.name as project_name
       FROM payment_milestones pm
       JOIN projects p ON p.id = pm.project_id AND p.tenant_id = $1
       WHERE pm.tenant_id = $1 AND pm.status != 'paid'
       ORDER BY pm.due_date ASC NULLS LAST
       LIMIT 5`,
      [tenantId]
    );
    return success(res, rows);
  } catch (err) {
    console.error('[Dashboard] Payments due error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to load payments due', 500);
  }
});

module.exports = router;
