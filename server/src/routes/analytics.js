const express = require('express');
const { authenticate } = require('../middleware/authenticate');
const { authorize } = require('../middleware/authorize');
const { success, fail } = require('../utils/response');
const pool = require('../config/db');

const router = express.Router();

router.use(authenticate);

const getDates = (req) => {
  const to = req.query.to ? new Date(req.query.to) : new Date();
  const from = req.query.from ? new Date(req.query.from) : new Date(to.getTime() - 30 * 24 * 60 * 60 * 1000);
  return { from, to };
};

router.get('/leads', authorize('analytics:read'), async (req, res) => {
  const tenantId = req.tenantId;
  const { from, to } = getDates(req);

  try {
    const [kpisRes, funnelRes, sourceRes, trendRes, teamRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) as total_leads,
          COUNT(*) FILTER (WHERE ls.is_won=true) as won_leads,
          ROUND(AVG(l.score)) as avg_score
        FROM leads l LEFT JOIN lead_stages ls ON ls.id=l.stage_id
        WHERE l.tenant_id=$1 AND l.created_at BETWEEN $2 AND $3 AND l.deleted_at IS NULL
      `, [tenantId, from, to]),
      pool.query(`
        SELECT ls.name, ls.color, COUNT(l.id) as count
        FROM lead_stages ls
        LEFT JOIN leads l ON l.stage_id=ls.id AND l.deleted_at IS NULL
          AND l.created_at BETWEEN $2 AND $3
        WHERE ls.tenant_id=$1
        GROUP BY ls.id ORDER BY ls.sort_order
      `, [tenantId, from, to]),
      pool.query(`
        SELECT source, COUNT(*) as count,
          COUNT(*) FILTER (WHERE ls.is_won=true) as won_count
        FROM leads l LEFT JOIN lead_stages ls ON ls.id=l.stage_id
        WHERE l.tenant_id=$1 AND l.created_at BETWEEN $2 AND $3 AND l.deleted_at IS NULL
        GROUP BY source ORDER BY count DESC
      `, [tenantId, from, to]),
      pool.query(`
        SELECT date_trunc('week', l.created_at) as week,
          COUNT(*) as created,
          COUNT(*) FILTER (WHERE ls.is_won=true) as won
        FROM leads l LEFT JOIN lead_stages ls ON ls.id=l.stage_id
        WHERE l.tenant_id=$1 AND l.created_at >= NOW()-INTERVAL '12 weeks' AND l.deleted_at IS NULL
        GROUP BY week ORDER BY week
      `, [tenantId]),
      pool.query(`
        SELECT u.id, u.name, u.avatar_url,
          COUNT(l.id) as total_leads,
          COUNT(l.id) FILTER (WHERE ls.is_won=true) as won_leads,
          ROUND(AVG(l.score)) as avg_score,
          MAX(a.created_at) as last_activity
        FROM users u
        LEFT JOIN leads l ON l.assignee_id=u.id AND l.tenant_id=$1
          AND l.created_at BETWEEN $2 AND $3
        LEFT JOIN lead_stages ls ON ls.id=l.stage_id
        LEFT JOIN activities a ON a.user_id=u.id AND a.tenant_id=$1
        WHERE u.tenant_id=$1
        GROUP BY u.id ORDER BY won_leads DESC
      `, [tenantId, from, to])
    ]);

    res.json(success({
      kpis: kpisRes.rows[0],
      stageFunnel: funnelRes.rows,
      sourceBreakdown: sourceRes.rows,
      weeklyTrend: trendRes.rows,
      teamPerformance: teamRes.rows
    }));
  } catch (error) {
    res.status(500).json(fail('Leads analytics failed'));
  }
});

router.get('/projects', authorize('analytics:read'), async (req, res) => {
  const tenantId = req.tenantId;
  const { from, to } = getDates(req);

  try {
    const [kpisRes, distRes, revenueRes, completionRes, delayedRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE status='active') as active,
          COUNT(*) FILTER (WHERE status='completed' AND updated_at BETWEEN $2 AND $3) as completed_period,
          COALESCE(SUM(pm.paid_amount),0) as revenue_collected,
          ROUND(AVG(EXTRACT(EPOCH FROM (COALESCE(p.updated_at,NOW())-p.created_at))/86400)) as avg_duration_days
        FROM projects p
        LEFT JOIN payment_milestones pm ON pm.project_id=p.id AND pm.status='paid'
        WHERE p.tenant_id=$1 AND p.deleted_at IS NULL
      `, [tenantId, from, to]),
      pool.query(`
        SELECT status, COUNT(*) as count FROM projects
        WHERE tenant_id=$1 AND deleted_at IS NULL GROUP BY status
      `, [tenantId]),
      pool.query(`
        SELECT date_trunc('month', pm.due_date) as month,
          COALESCE(SUM(pm.amount),0) as planned,
          COALESCE(SUM(pm.paid_amount) FILTER (WHERE pm.status='paid'),0) as collected
        FROM payment_milestones pm
        JOIN projects p ON p.id=pm.project_id
        WHERE p.tenant_id=$1 AND pm.due_date >= NOW()-INTERVAL '6 months'
        GROUP BY month ORDER BY month
      `, [tenantId]),
      pool.query(`
        SELECT p.id, p.name, p.client_name,
          COUNT(t.id) as total_tasks,
          COUNT(t.id) FILTER (WHERE t.status='done') as done_tasks,
          ROUND(100.0 * COUNT(t.id) FILTER (WHERE t.status='done') / NULLIF(COUNT(t.id),0)) as pct
        FROM projects p
        LEFT JOIN tasks t ON t.project_id=p.id AND t.deleted_at IS NULL
        WHERE p.tenant_id=$1 AND p.status='active' AND p.deleted_at IS NULL
        GROUP BY p.id ORDER BY pct ASC NULLS LAST LIMIT 8
      `, [tenantId]),
      pool.query(`
        SELECT p.*, u.name as pm_name,
          EXTRACT(DAY FROM NOW()-p.target_date) as days_overdue,
          (SELECT ph.name FROM project_phases ph WHERE ph.project_id=p.id AND ph.status='in_progress' LIMIT 1) as current_phase
        FROM projects p LEFT JOIN users u ON u.id=p.pm_id
        WHERE p.tenant_id=$1 AND p.status='active'
        AND p.target_date < NOW() AND p.deleted_at IS NULL
        ORDER BY days_overdue DESC
      `, [tenantId])
    ]);

    res.json(success({
      kpis: kpisRes.rows[0],
      statusDist: distRes.rows,
      monthlyRevenue: revenueRes.rows,
      taskCompletion: completionRes.rows,
      delayedProjects: delayedRes.rows
    }));
  } catch (error) {
    res.status(500).json(fail('Projects analytics failed'));
  }
});

module.exports = router;
