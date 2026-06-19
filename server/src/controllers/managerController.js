const pool = require('../db/pool');
const { success, fail } = require('../utils/response');

exports.getSlaBreaches = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const { rows } = await pool.query(`
      SELECT l.id, l.name, u.name as rep_name, 'New > 4h' as breach_type,
             ROUND(EXTRACT(EPOCH FROM (NOW() - l.created_at))/3600)::int as hours_overdue,
             s.name as stage
      FROM leads l
      LEFT JOIN users u ON l.assignee_id = u.id
      LEFT JOIN lead_stages s ON l.stage_id = s.id
      WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
        AND l.created_at < NOW() - INTERVAL '4 hours'
        AND NOT EXISTS (
          SELECT 1 FROM activities a WHERE a.lead_id = l.id
        )

      UNION ALL

      SELECT l.id, l.name, u.name as rep_name, 'Contacted > 3d' as breach_type,
             ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(
               (SELECT MAX(a.created_at) FROM activities a WHERE a.lead_id = l.id),
               l.created_at
             )))/3600)::int as hours_overdue,
             s.name as stage
      FROM leads l
      LEFT JOIN users u ON l.assignee_id = u.id
      LEFT JOIN lead_stages s ON l.stage_id = s.id
      WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
        AND s.name ILIKE '%contact%'
        AND COALESCE(
          (SELECT MAX(a.created_at) FROM activities a WHERE a.lead_id = l.id),
          l.created_at
        ) < NOW() - INTERVAL '3 days'

      UNION ALL

      SELECT l.id, l.name, u.name as rep_name, 'Proposal > 7d' as breach_type,
             ROUND(EXTRACT(EPOCH FROM (NOW() - COALESCE(
               (SELECT MAX(a.created_at) FROM activities a WHERE a.lead_id = l.id),
               l.created_at
             )))/3600)::int as hours_overdue,
             s.name as stage
      FROM leads l
      LEFT JOIN users u ON l.assignee_id = u.id
      LEFT JOIN lead_stages s ON l.stage_id = s.id
      WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
        AND s.name ILIKE '%proposal%'
        AND COALESCE(
          (SELECT MAX(a.created_at) FROM activities a WHERE a.lead_id = l.id),
          l.created_at
        ) < NOW() - INTERVAL '7 days'

      ORDER BY hours_overdue DESC
    `, [tenantId]);
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

exports.getPipelineMovement = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const { rows } = await pool.query(`
      SELECT a.id, a.title as transition, u.name as rep_name, a.created_at, l.name as lead_name
      FROM activities a
      JOIN leads l ON a.lead_id = l.id
      LEFT JOIN users u ON a.user_id = u.id
      WHERE l.tenant_id = $1 AND a.type = 'stage_change'
        AND a.created_at >= CURRENT_DATE
        AND a.created_at < CURRENT_DATE + INTERVAL '1 day'
      ORDER BY a.created_at DESC
    `, [tenantId]);
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

exports.getRepCapacity = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const { rows } = await pool.query(`
      SELECT
        u.id as rep_id, u.name as rep_name, u.avatar_url,
        COUNT(l.id) as active_leads,
        SUM(CASE WHEN l.score >= 70 THEN 1 ELSE 0 END) as hot_leads,
        (
          SELECT COUNT(DISTINCT a.lead_id) FROM activities a
          WHERE a.user_id = u.id
            AND a.created_at >= CURRENT_DATE
            AND a.created_at < CURRENT_DATE + INTERVAL '1 day'
        ) as contacted_today
      FROM users u
      LEFT JOIN leads l ON l.assignee_id = u.id
        AND l.tenant_id = $1
        AND l.deleted_at IS NULL
        AND l.status = 'active'
      WHERE u.tenant_id = $1 AND u.status = 'active'
      GROUP BY u.id, u.name, u.avatar_url
      ORDER BY active_leads DESC
    `, [tenantId]);
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

exports.getScoreDistribution = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const { rows } = await pool.query(`
      SELECT
        CASE
          WHEN score >= 70 THEN 'hot'
          WHEN score >= 40 THEN 'warm'
          WHEN score >= 10 THEN 'cold'
          ELSE 'dead'
        END as score_tier,
        COUNT(*) as count
      FROM leads
      WHERE tenant_id = $1 AND deleted_at IS NULL AND status = 'active'
      GROUP BY score_tier
    `, [tenantId]);

    const distribution = { hot: 0, warm: 0, cold: 0, dead: 0 };
    rows.forEach(r => {
      if (r.score_tier) distribution[r.score_tier] = parseInt(r.count, 10);
    });

    return success(res, distribution);
  } catch (err) {
    next(err);
  }
};

exports.getPendingApprovals = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    // discount_approvals table may not exist yet — return empty gracefully
    const { rows } = await pool.query(`
      SELECT d.id, l.name as lead_name, d.original_amount, d.discount_percent,
             u.name as rep_name, d.created_at
      FROM discount_approvals d
      JOIN leads l ON d.lead_id = l.id
      JOIN users u ON d.rep_id = u.id
      WHERE d.tenant_id = $1 AND d.status = 'pending'
      ORDER BY d.created_at DESC
    `, [tenantId]).catch(() => ({ rows: [] }));
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

exports.decideApproval = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const { status } = req.body;
    const approvalId = req.params.id;

    if (!['approved', 'rejected'].includes(status)) {
      return fail(res, 'VALIDATION_ERROR', 'Invalid status', 400);
    }

    await pool.query(`
      UPDATE discount_approvals SET status = $1, updated_at = NOW()
      WHERE id = $2 AND tenant_id = $3
    `, [status, approvalId, tenantId]);

    return success(res, { message: 'Approval updated' });
  } catch (err) {
    next(err);
  }
};

exports.getScheduledVisits = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const { rows } = await pool.query(`
      SELECT a.id, l.name as lead_name, a.title, a.scheduled_at, u.name as rep_name, a.outcome
      FROM activities a
      JOIN leads l ON a.lead_id = l.id
      LEFT JOIN users u ON a.user_id = u.id
      WHERE l.tenant_id = $1 AND a.type IN ('site_visit', 'meeting')
        AND a.scheduled_at >= CURRENT_DATE
        AND a.scheduled_at < CURRENT_DATE + INTERVAL '1 day'
      ORDER BY a.scheduled_at ASC
    `, [tenantId]);
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

exports.getPredictiveRevenue = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user?.tenantId;
    const { rows } = await pool.query(`
      SELECT 
        s.name as stage_name,
        SUM(l.budget_max) as total_pipeline,
        SUM(l.budget_max * (COALESCE(l.win_probability, 0) / 100.0)) as expected_revenue,
        COUNT(l.id) as lead_count
      FROM leads l
      LEFT JOIN lead_stages s ON l.stage_id = s.id
      WHERE l.tenant_id = $1 
        AND l.deleted_at IS NULL 
        AND l.status = 'active'
        AND l.budget_max IS NOT NULL
      GROUP BY s.name
      ORDER BY expected_revenue DESC
    `, [tenantId]);
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};
