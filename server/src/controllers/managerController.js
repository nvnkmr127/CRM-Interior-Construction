const pool = require('../config/db');
const { success, fail } = require('../utils/response');

exports.getSlaBreaches = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    
    // We combine three distinct breach checks into one query using UNION ALL
    const query = `
      -- Breach 1: New leads > 4h without first contact
      SELECT l.id, l.name, u.name as rep_name, 'New > 4h' as breach_type,
             ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - l.created_at))/3600) as hours_overdue, l.stage
      FROM leads l
      LEFT JOIN users u ON l.assigned_rep_id = u.id
      WHERE l.tenant_id = $1 AND l.stage = 'new' AND l.first_contacted_at IS NULL
        AND l.created_at < datetime('now', '-4 hours')

      UNION ALL

      -- Breach 2: Contacted > 3 days without recent activity
      SELECT l.id, l.name, u.name as rep_name, 'Contacted > 3d' as breach_type,
             ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE((
                 SELECT MAX(created_at) FROM lead_activities a WHERE a.lead_id = l.id
             ), l.created_at)))/3600) as hours_overdue, l.stage
      FROM leads l
      LEFT JOIN users u ON l.assigned_rep_id = u.id
      WHERE l.tenant_id = $1 AND l.stage = 'contacted'
        AND COALESCE((SELECT MAX(created_at) FROM lead_activities a WHERE a.lead_id = l.id), l.created_at) < datetime('now', '-3 days')

      UNION ALL

      -- Breach 3: Proposal Sent > 7 days without activity
      SELECT l.id, l.name, u.name as rep_name, 'Proposal > 7d' as breach_type,
             ROUND(EXTRACT(EPOCH FROM (CURRENT_TIMESTAMP - COALESCE((
                 SELECT MAX(created_at) FROM lead_activities a WHERE a.lead_id = l.id
             ), l.created_at)))/3600) as hours_overdue, l.stage
      FROM leads l
      LEFT JOIN users u ON l.assigned_rep_id = u.id
      WHERE l.tenant_id = $1 AND l.stage = 'proposal_sent'
        AND COALESCE((SELECT MAX(created_at) FROM lead_activities a WHERE a.lead_id = l.id), l.created_at) < datetime('now', '-7 days')
    `;

    // Wait, SQLite uses Julian day math or unixepoch, not EXTRACT(EPOCH).
    // Let's rewrite the query for SQLite using julianday.

    const sqliteQuery = `
      SELECT l.id, l.name, u.name as rep_name, 'New > 4h' as breach_type,
             CAST((julianday('now') - julianday(l.created_at)) * 24 AS INTEGER) as hours_overdue, l.stage
      FROM leads l
      LEFT JOIN users u ON l.assigned_rep_id = u.id
      WHERE l.tenant_id = $1 AND l.stage = 'new' AND l.first_contacted_at IS NULL
        AND l.created_at < datetime('now', '-4 hours')

      UNION ALL

      SELECT l.id, l.name, u.name as rep_name, 'Contacted > 3d' as breach_type,
             CAST((julianday('now') - julianday(COALESCE((SELECT MAX(created_at) FROM lead_activities a WHERE a.lead_id = l.id), l.created_at))) * 24 AS INTEGER) as hours_overdue, l.stage
      FROM leads l
      LEFT JOIN users u ON l.assigned_rep_id = u.id
      WHERE l.tenant_id = $1 AND l.stage = 'contacted'
        AND COALESCE((SELECT MAX(created_at) FROM lead_activities a WHERE a.lead_id = l.id), l.created_at) < datetime('now', '-3 days')

      UNION ALL

      SELECT l.id, l.name, u.name as rep_name, 'Proposal > 7d' as breach_type,
             CAST((julianday('now') - julianday(COALESCE((SELECT MAX(created_at) FROM lead_activities a WHERE a.lead_id = l.id), l.created_at))) * 24 AS INTEGER) as hours_overdue, l.stage
      FROM leads l
      LEFT JOIN users u ON l.assigned_rep_id = u.id
      WHERE l.tenant_id = $1 AND l.stage = 'proposal_sent'
        AND COALESCE((SELECT MAX(created_at) FROM lead_activities a WHERE a.lead_id = l.id), l.created_at) < datetime('now', '-7 days')
    `;

    const { rows } = await pool.query(sqliteQuery, [tenantId]);
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

exports.getPipelineMovement = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    // Look for stage_change activities today
    const { rows } = await pool.query(`
      SELECT a.id, a.summary as transition, u.name as rep_name, a.created_at, l.name as lead_name
      FROM lead_activities a
      JOIN leads l ON a.lead_id = l.id
      LEFT JOIN users u ON a.logged_by = u.id
      WHERE l.tenant_id = $1 AND a.type = 'stage_change' 
      AND date(a.created_at) = date('now')
      ORDER BY a.created_at DESC
    `, [tenantId]);
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

exports.getRepCapacity = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    // Active leads = not lost, not won, not dead
    const { rows } = await pool.query(`
      SELECT 
        u.id as rep_id, u.name as rep_name, u.avatar_url,
        COUNT(l.id) as active_leads,
        SUM(CASE WHEN l.score_tier = 'hot' THEN 1 ELSE 0 END) as hot_leads,
        (SELECT COUNT(DISTINCT a.lead_id) FROM lead_activities a 
         WHERE a.logged_by = u.id AND date(a.created_at) = date('now')) as contacted_today
      FROM users u
      LEFT JOIN leads l ON l.assigned_rep_id = u.id 
        AND l.tenant_id = $1 
        AND l.stage NOT IN ('won', 'lost')
        AND l.score_tier != 'dead'
      WHERE u.tenant_id = $1 AND u.role IN ('sales_rep', 'manager')
      GROUP BY u.id, u.name, u.avatar_url
    `, [tenantId]);
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

exports.getScoreDistribution = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { rows } = await pool.query(`
      SELECT score_tier, COUNT(id) as count
      FROM leads
      WHERE tenant_id = $1 AND stage NOT IN ('won', 'lost')
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
    const tenantId = req.tenantId;
    const { rows } = await pool.query(`
      SELECT d.id, l.name as lead_name, d.original_amount, d.discount_percent, u.name as rep_name, d.created_at
      FROM discount_approvals d
      JOIN leads l ON d.lead_id = l.id
      JOIN users u ON d.rep_id = u.id
      WHERE d.tenant_id = $1 AND d.status = 'pending'
      ORDER BY d.created_at DESC
    `, [tenantId]);
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};

exports.decideApproval = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { status } = req.body; // 'approved' or 'rejected'
    const approvalId = req.params.id;

    if (!['approved', 'rejected'].includes(status)) {
      return fail(res, 'VALIDATION_ERROR', 'Invalid status', 400);
    }

    await pool.query(`
      UPDATE discount_approvals SET status = $1, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND tenant_id = $3
    `, [status, approvalId, tenantId]);

    return success(res, { message: 'Approval updated' });
  } catch (err) {
    next(err);
  }
};

exports.getScheduledVisits = async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const { rows } = await pool.query(`
      SELECT a.id, l.name as lead_name, a.summary as title, a.created_at, u.name as rep_name, a.outcome
      FROM lead_activities a
      JOIN leads l ON a.lead_id = l.id
      LEFT JOIN users u ON a.logged_by = u.id
      WHERE l.tenant_id = $1 AND a.type IN ('site_visit', 'design_review')
      AND date(a.created_at) = date('now')
      ORDER BY a.created_at ASC
    `, [tenantId]);
    return success(res, rows);
  } catch (err) {
    next(err);
  }
};
