const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { success, fail } = require('../utils/response');
const pool = require('../config/db');

const router = express.Router();

router.use(authenticate);

// Helper to parse period into from/to dates
const getDates = (req) => {
  let periodDays = 30;
  if (req.query.period === '7d') periodDays = 7;
  else if (req.query.period === '90d') periodDays = 90;
  else if (req.query.period && req.query.period.match(/^\d+d$/)) {
    periodDays = parseInt(req.query.period, 10);
  }
  
  const to = new Date();
  const from = new Date(to.getTime() - periodDays * 24 * 60 * 60 * 1000);
  
  // Custom from/to override
  if (req.query.from) from.setTime(new Date(req.query.from).getTime());
  if (req.query.to) to.setTime(new Date(req.query.to).getTime());
  
  return { from, to };
};

// 1. GET /api/analytics/leads/summary
router.get('/leads/summary', async (req, res) => {
  try {
    const { from, to } = getDates(req);
    const tenantId = req.tenantId;

    const query = `
      SELECT 
        COUNT(l.id) as total_leads,
        COUNT(l.id) FILTER (WHERE ls.name ILIKE '%new%') as new_this_period,
        COALESCE(SUM(l.budget_max), 0) as pipeline_value_total,
        COUNT(l.id) FILTER (WHERE ls.is_won = true) as won_count,
        COUNT(l.id) FILTER (WHERE l.score >= 80) as tier_hot,
        COUNT(l.id) FILTER (WHERE l.score >= 50 AND l.score < 80) as tier_warm,
        COUNT(l.id) FILTER (WHERE l.score >= 20 AND l.score < 50) as tier_cold,
        COUNT(l.id) FILTER (WHERE l.score < 20) as tier_dead,
        AVG(EXTRACT(EPOCH FROM (l.updated_at - l.created_at))/86400) FILTER (WHERE ls.is_won = true) as avg_time_to_close_days
      FROM leads l
      LEFT JOIN lead_stages ls ON l.stage_id = ls.id
      WHERE l.tenant_id = $1 AND l.created_at BETWEEN $2 AND $3
    `;
    const result = await pool.query(query, [tenantId, from.toISOString(), to.toISOString()]);
    const row = result.rows[0];

    const total = parseInt(row.total_leads, 10) || 0;
    const won = parseInt(row.won_count, 10) || 0;
    const conversionRate = total > 0 ? ((won / total) * 100).toFixed(1) : 0;

    return success(res, {
      total_leads: total,
      new_this_period: parseInt(row.new_this_period, 10) || 0,
      conversion_rate: parseFloat(conversionRate),
      avg_time_to_close_days: parseFloat(row.avg_time_to_close_days || 0).toFixed(1),
      pipeline_value_total: parseFloat(row.pipeline_value_total || 0),
      leads_by_tier: {
        hot: parseInt(row.tier_hot, 10) || 0,
        warm: parseInt(row.tier_warm, 10) || 0,
        cold: parseInt(row.tier_cold, 10) || 0,
        dead: parseInt(row.tier_dead, 10) || 0
      }
    });
  } catch (err) {
    res.status(500).json(fail('Failed to fetch summary: ' + err.message));
  }
});

// 2. GET /api/analytics/leads/funnel
router.get('/leads/funnel', async (req, res) => {
  try {
    const { from, to } = getDates(req);
    const tenantId = req.tenantId;
    const query = `
      SELECT ls.name as stage, COUNT(l.id) as count 
      FROM leads l
      LEFT JOIN lead_stages ls ON l.stage_id = ls.id
      WHERE l.tenant_id = $1 AND l.created_at BETWEEN $2 AND $3 AND ls.name IS NOT NULL
      GROUP BY ls.name, ls.sort_order
      ORDER BY ls.sort_order ASC
    `;
    const result = await pool.query(query, [tenantId, from.toISOString(), to.toISOString()]);
    
    let prevCount = null;
    const funnel = result.rows.map(r => {
      const count = parseInt(r.count, 10);
      let drop_off_rate = 0;
      if (prevCount !== null && prevCount > 0) {
        drop_off_rate = (((prevCount - count) / prevCount) * 100).toFixed(1);
      }
      prevCount = count;
      return { stage: r.stage, count, drop_off_rate: parseFloat(drop_off_rate) };
    });

    return success(res, funnel);
  } catch (err) {
    res.status(500).json(fail('Failed to fetch funnel: ' + err.message));
  }
});

// 3. GET /api/analytics/leads/by_source
router.get('/leads/by_source', async (req, res) => {
  try {
    const { from, to } = getDates(req);
    const tenantId = req.tenantId;
    const query = `
      SELECT 
        l.source, 
        COUNT(l.id) as count, 
        COUNT(l.id) FILTER (WHERE ls.is_won = true) as won_count,
        0 as total_value
      FROM leads l
      LEFT JOIN lead_stages ls ON l.stage_id = ls.id
      WHERE l.tenant_id = $1 AND l.created_at BETWEEN $2 AND $3 AND l.source IS NOT NULL
      GROUP BY l.source
      ORDER BY count DESC
    `;
    const result = await pool.query(query, [tenantId, from.toISOString(), to.toISOString()]);
    
    const data = result.rows.map(r => {
      const count = parseInt(r.count, 10);
      const won = parseInt(r.won_count, 10);
      return {
        source: r.source,
        count,
        won_count: won,
        conversion_rate: count > 0 ? parseFloat(((won / count) * 100).toFixed(1)) : 0,
        total_value: parseFloat(r.total_value || 0)
      };
    });

    return success(res, data);
  } catch (err) {
    res.status(500).json(fail('Failed to fetch sources: ' + err.message));
  }
});

// 4. GET /api/analytics/leads/rep_performance
router.get('/leads/rep_performance', async (req, res) => {
  try {
    const { from, to } = getDates(req);
    const tenantId = req.tenantId;
    const query = `
      SELECT 
        u.id as rep_id, 
        u.name as rep_name,
        u.avatar_url,
        COUNT(l.id) as leads_assigned,
        COUNT(l.id) FILTER (WHERE ls.is_won = true) as won,
        0 as contacted_within_sla
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN leads l ON l.assignee_id = u.id AND l.tenant_id = $1 AND l.created_at BETWEEN $2 AND $3
      LEFT JOIN lead_stages ls ON l.stage_id = ls.id
      WHERE u.tenant_id = $1 AND (r.name = 'sales_executive' OR r.name = 'sales_rep')
      GROUP BY u.id
      ORDER BY won DESC
    `;
    const result = await pool.query(query, [tenantId, from.toISOString(), to.toISOString()]);
    
    const activitiesQuery = `
      SELECT user_id as rep_id, type, COUNT(id) as act_count
      FROM activities
      WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
      GROUP BY user_id, type
    `;
    const actResult = await pool.query(activitiesQuery, [tenantId, from.toISOString(), to.toISOString()]);
    
    const activitiesMap = {};
    actResult.rows.forEach(r => {
      if (!activitiesMap[r.rep_id]) activitiesMap[r.rep_id] = { site_visit: 0, proposal: 0 };
      if (r.type === 'site_visit') activitiesMap[r.rep_id].site_visit = parseInt(r.act_count, 10);
    });

    const quotesQuery = `
      SELECT created_by as rep_id, COUNT(id) as quote_count
      FROM quotations
      WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
      GROUP BY created_by
    `;
    const quotesResult = await pool.query(quotesQuery, [tenantId, from.toISOString(), to.toISOString()]);
    
    const quotesMap = {};
    quotesResult.rows.forEach(r => {
      quotesMap[r.rep_id] = parseInt(r.quote_count, 10);
    });

    const data = result.rows.map(r => {
      const assigned = parseInt(r.leads_assigned, 10);
      const won = parseInt(r.won, 10);
      const acts = activitiesMap[r.rep_id] || {};
      return {
        rep_id: r.rep_id,
        rep_name: r.rep_name,
        avatar_url: r.avatar_url,
        leads_assigned: assigned,
        contacted_within_sla: parseInt(r.contacted_within_sla, 10),
        visits_done: acts.site_visit || 0,
        proposals_sent: quotesMap[r.rep_id] || 0,
        won,
        conversion_rate: assigned > 0 ? parseFloat(((won / assigned) * 100).toFixed(1)) : 0
      };
    });

    return success(res, data);
  } catch (err) {
    res.status(500).json(fail('Failed to fetch rep performance: ' + err.message));
  }
});

// 5. GET /api/analytics/leads/lost_reasons
router.get('/leads/lost_reasons', async (req, res) => {
  try {
    const { from, to } = getDates(req);
    const tenantId = req.tenantId;
    const query = `
      SELECT COALESCE(NULLIF(TRIM(l.custom_fields->>'lost_reason'), ''), 'No Reason Given') as reason, COUNT(l.id) as count
      FROM leads l
      LEFT JOIN lead_stages ls ON l.stage_id = ls.id
      WHERE l.tenant_id = $1 AND ls.is_lost = true AND l.created_at BETWEEN $2 AND $3
      GROUP BY COALESCE(NULLIF(TRIM(l.custom_fields->>'lost_reason'), ''), 'No Reason Given')
      HAVING COUNT(l.id) > 0
    `;
    const result = await pool.query(query, [tenantId, from.toISOString(), to.toISOString()]);
    
    const totalLost = result.rows.reduce((sum, r) => sum + parseInt(r.count, 10), 0);
    const data = result.rows.map(r => {
      const c = parseInt(r.count, 10);
      return {
        reason: r.reason,
        count: c,
        percentage: totalLost > 0 ? parseFloat(((c / totalLost) * 100).toFixed(1)) : 0
      };
    });

    return success(res, data);
  } catch (err) {
    res.status(500).json(fail('Failed to fetch lost reasons: ' + err.message));
  }
});

router.get('/projects', authorize('analytics:read'), async (req, res) => {
  const tenantId = req.tenantId;
  const { from, to } = getDates(req);

  try {
    const [kpisRes, distRes, revenueRes, completionRes, delayedRes] = await Promise.all([
      pool.query(`
        SELECT
          COUNT(*) FILTER (WHERE p.status='active') as active,
          COUNT(*) FILTER (WHERE p.status='completed' AND p.updated_at BETWEEN $2 AND $3) as completed_period,
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

    return success(res, {
      kpis: kpisRes.rows[0],
      statusDist: distRes.rows,
      monthlyRevenue: revenueRes.rows,
      taskCompletion: completionRes.rows,
      delayedProjects: delayedRes.rows
    });
  } catch (error) {
    res.status(500).json(fail('Projects analytics failed'));
  }
});

/**
 * GET /api/analytics/projects
 * Returns analytics data for projects.
 * Query params: from (ISO date), to (ISO date)
 */
router.get('/projects', async (req, res) => {
  try {
    const { from, to } = req.query;
    const tenantId = req.tenantId;

    let dateFilter = '';
    const values = [tenantId];

    if (from && to) {
      dateFilter = ' AND p.created_at BETWEEN $2 AND $3 ';
      values.push(from, to);
    } else if (from) {
      dateFilter = ' AND p.created_at >= $2 ';
      values.push(from);
    } else if (to) {
      dateFilter = ' AND p.created_at <= $2 ';
      values.push(to);
    }

    // 1. Status distribution
    const statusQuery = `
      SELECT p.status, COUNT(p.id) as count
      FROM projects p
      WHERE p.tenant_id = $1 ${dateFilter}
      GROUP BY p.status
      ORDER BY count DESC
    `;
    const statusRes = await pool.query(statusQuery, values);

    // 2. Revenue: planned vs collected per month (last 12 months)
    const revenueQuery = `
      SELECT
        TO_CHAR(DATE_TRUNC('month', pm.due_date), 'Mon') as month,
        SUM(pm.amount) as planned,
        SUM(CASE WHEN pm.status = 'paid' THEN pm.amount ELSE 0 END) as collected
      FROM payment_milestones pm
      JOIN projects p ON p.id = pm.project_id AND p.tenant_id = $1
      WHERE pm.due_date >= NOW() - INTERVAL '12 months'
      GROUP BY DATE_TRUNC('month', pm.due_date)
      ORDER BY DATE_TRUNC('month', pm.due_date) ASC
    `;
    const revenueRes = await pool.query(revenueQuery, [tenantId]);

    // 3. Delayed projects (past target date, not completed)
    const delayedQuery = `
      SELECT p.id, p.name, p.target_date, p.status,
             u.name as pm_name,
             CURRENT_DATE - p.target_date::date as days_delayed
      FROM projects p
      LEFT JOIN users u ON u.id = p.pm_id AND u.tenant_id = $1
      WHERE p.tenant_id = $1
        AND p.target_date < CURRENT_DATE
        AND p.status NOT IN ('completed', 'cancelled')
      ORDER BY days_delayed DESC
      LIMIT 10
    `;
    const delayedRes = await pool.query(delayedQuery, [tenantId]);

    // 4. Top projects by value
    const topProjectsQuery = `
      SELECT p.id, p.name, p.contract_value as value, p.status
      FROM projects p
      WHERE p.tenant_id = $1 ${dateFilter}
        AND p.contract_value IS NOT NULL
      ORDER BY p.contract_value DESC
      LIMIT 5
    `;
    const topRes = await pool.query(topProjectsQuery, values);

    res.json({
      success: true,
      data: {
        statusDistribution: statusRes.rows.map(r => ({ ...r, count: parseInt(r.count, 10) })),
        revenueTimeline: revenueRes.rows.map(r => ({
          month: r.month,
          planned: parseFloat(r.planned) || 0,
          collected: parseFloat(r.collected) || 0,
        })),
        delayedProjects: delayedRes.rows.map(r => ({
          ...r,
          days_delayed: parseInt(r.days_delayed, 10) || 0,
        })),
        topProjects: topRes.rows.map(r => ({
          ...r,
          value: parseFloat(r.value) || 0,
        })),
      }
    });
  } catch (err) {
    console.error('Project Analytics Error:', err);
    res.status(500).json({ success: false, error: 'Failed to fetch project analytics data' });
  }
});

const analyticsController = require('../controllers/analyticsController');

// Phase 2: Dedicated Analytics Endpoints
router.get('/revenue', authenticate, authorize('analytics:read'), analyticsController.getRevenueAnalytics);
router.get('/pipeline', authenticate, authorize('analytics:read'), analyticsController.getPipelineAnalytics);
router.get('/conversion', authenticate, authorize('analytics:read'), analyticsController.getConversionAnalytics);
router.get('/forecast', authenticate, authorize('analytics:read'), analyticsController.getForecastAnalytics);

module.exports = router;
