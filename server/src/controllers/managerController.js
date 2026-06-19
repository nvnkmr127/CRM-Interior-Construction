const pool = require('../db/pool');

function getTenantAndUser(req) {
  return { tenantId: req.user.tenantId, userId: req.user.id };
}

exports.getSlaBreaches = async (req, res) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    // Dynamic SLA breaches: 'new' leads > 2 days, or any lead > 7 days in current stage
    const result = await pool.query(
      `SELECT id, name, status, stage_id, created_at, updated_at,
              EXTRACT(EPOCH FROM (NOW() - updated_at))/3600 AS hours_overdue,
              CASE 
                WHEN status = 'new' THEN 'New Lead SLA'
                ELSE 'Stale Stage SLA'
              END as breach_type
       FROM leads 
       WHERE tenant_id = $1 
         AND status NOT IN ('won', 'lost')
         AND (
           (status = 'new' AND updated_at < NOW() - INTERVAL '2 days')
           OR
           (updated_at < NOW() - INTERVAL '7 days')
         )`,
      [tenantId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getSlaBreaches error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch SLA breaches' });
  }
};

exports.getPipelineMovement = async (req, res) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    // Pipeline movement today: Audit logs or activities representing stage changes today
    const result = await pool.query(
      `SELECT la.id, l.name as lead_name, la.notes as transition, u.name as rep_name, la.created_at 
       FROM lead_activities la
       JOIN leads l ON l.id = la.lead_id
       LEFT JOIN users u ON u.id = la.created_by
       WHERE la.tenant_id = $1 
         AND la.type = 'status_change'
         AND la.created_at >= CURRENT_DATE
       ORDER BY la.created_at DESC`,
      [tenantId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getPipelineMovement error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pipeline movement' });
  }
};

exports.getRepCapacity = async (req, res) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const result = await pool.query(
      `SELECT u.id as rep_id, u.name as rep_name, u.avatar_url,
              COUNT(l.id) as active_leads,
              (SELECT COUNT(DISTINCT lead_id) 
               FROM lead_activities 
               WHERE created_by = u.id AND created_at >= CURRENT_DATE) as contacted_today
       FROM users u
       LEFT JOIN leads l ON l.assignee_id = u.id AND l.status NOT IN ('won', 'lost')
       WHERE u.tenant_id = $1 AND u.role IN ('sales_rep', 'admin')
       GROUP BY u.id, u.name, u.avatar_url
       ORDER BY active_leads DESC`,
      [tenantId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getRepCapacity error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch rep capacity' });
  }
};

exports.getScoreDistribution = async (req, res) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const result = await pool.query(
      `SELECT 
        COUNT(CASE WHEN score >= 80 THEN 1 END) as hot,
        COUNT(CASE WHEN score >= 50 AND score < 80 THEN 1 END) as warm,
        COUNT(CASE WHEN score < 50 AND status != 'lost' THEN 1 END) as cold,
        COUNT(CASE WHEN status = 'lost' THEN 1 END) as dead
       FROM leads 
       WHERE tenant_id = $1`,
      [tenantId]
    );
    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    console.error('getScoreDistribution error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch score distribution' });
  }
};

exports.getPendingApprovals = async (req, res) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const result = await pool.query(
      `SELECT * FROM (
         SELECT l.id, l.name as lead_name, u.name as rep_name, 
                (l.custom_fields->'negotiation'->>'target_price')::numeric as target_price,
                (l.custom_fields->'negotiation'->>'quoted_price')::numeric as quoted_price,
                l.custom_fields->'negotiation'->>'notes' as notes
         FROM leads l
         LEFT JOIN users u ON u.id = l.assignee_id
         WHERE l.tenant_id = $1 
           AND l.custom_fields ? 'negotiation'
           AND (l.custom_fields->'negotiation'->>'status') IS NULL
           AND (l.custom_fields->'negotiation'->>'target_price') IS NOT NULL
       ) reqs WHERE quoted_price > 0`,
      [tenantId]
    );
    
    // Map to expected frontend format
    const approvals = result.rows.map(r => {
      const original = r.quoted_price || 0;
      const target = r.target_price || 0;
      let discount = 0;
      if (original > 0) {
        discount = Math.round(((original - target) / original) * 100);
      }
      return {
        id: r.id,
        lead_name: r.lead_name,
        rep_name: r.rep_name,
        discount_percent: discount,
        original_amount: original,
        target_amount: target
      };
    });

    res.json({ success: true, data: approvals });
  } catch (error) {
    console.error('getPendingApprovals error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch pending approvals' });
  }
};

exports.decideApproval = async (req, res) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id } = req.params;
    const { status } = req.body; // 'approved' or 'rejected'

    const leadRes = await pool.query('SELECT custom_fields FROM leads WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (leadRes.rows.length === 0) return res.status(404).json({ success: false, error: 'Lead not found' });
    
    const cf = leadRes.rows[0].custom_fields || {};
    if (!cf.negotiation) cf.negotiation = {};
    cf.negotiation.status = status;

    await pool.query('UPDATE leads SET custom_fields = $1 WHERE id = $2 AND tenant_id = $3', [JSON.stringify(cf), id, tenantId]);

    res.json({ success: true });
  } catch (error) {
    console.error('decideApproval error:', error);
    res.status(500).json({ success: false, error: 'Failed to update approval' });
  }
};

exports.getScheduledVisits = async (req, res) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const result = await pool.query(
      `SELECT sv.id, sv.title, sv.scheduled_at as created_at, l.name as lead_name, u.name as rep_name
       FROM site_visits sv
       JOIN leads l ON l.id = sv.lead_id
       LEFT JOIN users u ON u.id = sv.assigned_to
       WHERE sv.tenant_id = $1 
         AND DATE(sv.scheduled_at) = CURRENT_DATE
         AND sv.status = 'scheduled'
       ORDER BY sv.scheduled_at ASC`,
      [tenantId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getScheduledVisits error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch scheduled visits' });
  }
};

exports.getPredictiveRevenue = async (req, res) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const result = await pool.query(
      `SELECT 
        s.name as stage_name,
        COUNT(l.id) as lead_count,
        SUM(COALESCE(l.revenue_potential, l.budget_max, 0)) as total_pipeline,
        SUM(COALESCE(l.revenue_potential, l.budget_max, 0) * (COALESCE(l.win_probability, l.score, 50) / 100.0)) as expected_revenue
       FROM leads l
       LEFT JOIN stages s ON l.stage_id = s.id
       WHERE l.tenant_id = $1 AND l.status NOT IN ('won', 'lost')
       GROUP BY s.name, s.order_index
       ORDER BY s.order_index ASC`,
      [tenantId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getPredictiveRevenue error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch predictive revenue' });
  }
};

exports.getHeatMapData = async (req, res) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const result = await pool.query(
      `SELECT locality, COUNT(*) as count, SUM(budget_max) as total_value
       FROM leads 
       WHERE tenant_id = $1 AND locality IS NOT NULL
       GROUP BY locality
       ORDER BY count DESC LIMIT 10`,
      [tenantId]
    );
    res.json({ success: true, data: result.rows });
  } catch (error) {
    console.error('getHeatMapData error:', error);
    res.status(500).json({ success: false, error: 'Failed to fetch heatmap data' });
  }
};
