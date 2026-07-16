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

exports.getRevivalCandidatesHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { getRevivalCandidates } = require('../services/leads/pipelineIntelligenceService');
    const candidates = await getRevivalCandidates(tenantId);
    res.json({ success: true, data: candidates });
  } catch (error) {
    console.error('getRevivalCandidatesHandler error:', error);
    next(error);
  }
};

exports.getAtRiskDealsHandler = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { getAtRiskDeals } = require('../services/leads/pipelineIntelligenceService');
    const atRisk = await getAtRiskDeals(tenantId);
    res.json({ success: true, data: atRisk });
  } catch (error) {
    console.error('getAtRiskDealsHandler error:', error);
    next(error);
  }
};

exports.getHeatMapData = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    // Group leads by city and calculate total potential budget
    const { rows } = await pool.query(
      `SELECT city, COUNT(id) as total_leads, SUM(budget_max) as total_budget, AVG(score) as avg_score
       FROM leads
       WHERE tenant_id = $1 AND status NOT IN ('won', 'lost', 'archived') AND city IS NOT NULL
       GROUP BY city
       ORDER BY total_budget DESC NULLS LAST
       LIMIT 50`,
      [tenantId]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getHeatMapData error:', error);
    next(error);
  }
};

exports.getRevenueForecast = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    // Simple mock grouping by current quarter. Uses win_probability and budget_max
    const { rows } = await pool.query(
      `SELECT 
         date_trunc('month', created_at) as month,
         COUNT(id) as total_active_deals,
         SUM(budget_max) as total_pipeline_value,
         SUM(budget_max * (win_probability / 100.0)) as expected_revenue
       FROM leads
       WHERE tenant_id = $1 AND status NOT IN ('won', 'lost', 'archived')
       GROUP BY month
       ORDER BY month ASC
       LIMIT 6`,
      [tenantId]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getRevenueForecast error:', error);
    next(error);
  }
};

exports.getBuilderIntelligence = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    // Assuming builder name is stored in custom_fields -> builder_name
    const { rows } = await pool.query(
      `SELECT 
         custom_fields->>'builder_name' as builder_name,
         COUNT(id) as total_projects,
         SUM(CASE WHEN status = 'won' THEN 1 ELSE 0 END) as won_projects,
         SUM(budget_max) as total_revenue
       FROM leads
       WHERE tenant_id = $1 AND custom_fields->>'builder_name' IS NOT NULL
       GROUP BY builder_name
       ORDER BY total_projects DESC
       LIMIT 20`,
      [tenantId]
    );

    res.json({ success: true, data: rows });
  } catch (error) {
    console.error('getBuilderIntelligence error:', error);
    next(error);
  }
};

exports.getPredictiveDashboard = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    
    // We aggregate data from the pipeline intelligence service and other heuristic engines.
    const { getAtRiskDeals, getRevivalCandidates } = require('../services/leads/pipelineIntelligenceService');
    const atRisk = await getAtRiskDeals(tenantId);
    const revivals = await getRevivalCandidates(tenantId);

    // Get expected revenue summary
    const revenueRes = await pool.query(
      `SELECT 
         SUM(budget_max) as total_pipeline_value,
         SUM(budget_max * (win_probability / 100.0)) as total_expected_revenue
       FROM leads
       WHERE tenant_id = $1 AND status NOT IN ('won', 'lost', 'archived')`,
      [tenantId]
    );

    res.json({
      success: true,
      data: {
        atRiskDealsCount: atRisk.length,
        atRiskDeals: atRisk,
        revivalCandidatesCount: revivals.length,
        revivalCandidates: revivals,
        revenue: revenueRes.rows[0]
      }
    });
  } catch (error) {
    console.error('getPredictiveDashboard error:', error);
    next(error);
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

exports.getBenchmarks = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);

    // Get company average and cycle days
    const overallQuery = `
      SELECT 
        COUNT(l.id) as total_leads,
        COUNT(l.id) FILTER (WHERE ls.is_won = true) as total_won,
        AVG(EXTRACT(EPOCH FROM (l.updated_at - l.created_at))/86400) FILTER (WHERE ls.is_won = true) as avg_cycle_days
      FROM leads l
      LEFT JOIN lead_stages ls ON l.stage_id = ls.id
      WHERE l.tenant_id = $1
    `;
    const overallRes = await pool.query(overallQuery, [tenantId]);
    const overall = overallRes.rows[0];
    const totalLeads = parseInt(overall.total_leads, 10) || 0;
    const totalWon = parseInt(overall.total_won, 10) || 0;
    const companyAvg = totalLeads > 0 ? (totalWon / totalLeads) * 100 : 0;
    const avgCycleDays = overall.avg_cycle_days ? parseFloat(overall.avg_cycle_days) : 0;

    // Get top performer conversion rate
    const topPerformerQuery = `
      SELECT 
        COUNT(l.id) as rep_total,
        COUNT(l.id) FILTER (WHERE ls.is_won = true) as rep_won
      FROM leads l
      LEFT JOIN lead_stages ls ON l.stage_id = ls.id
      WHERE l.tenant_id = $1 AND l.assignee_id IS NOT NULL
      GROUP BY l.assignee_id
      HAVING COUNT(l.id) > 0
    `;
    const topRes = await pool.query(topPerformerQuery, [tenantId]);
    let topPerformerConversion = 0;
    topRes.rows.forEach(r => {
      const repTotal = parseInt(r.rep_total, 10) || 0;
      const repWon = parseInt(r.rep_won, 10) || 0;
      if (repTotal > 0) {
        const rate = (repWon / repTotal) * 100;
        if (rate > topPerformerConversion) {
          topPerformerConversion = rate;
        }
      }
    });

    res.json({
      success: true,
      data: {
        companyAverageConversion: parseFloat(companyAvg.toFixed(1)),
        topPerformerConversion: parseFloat(topPerformerConversion.toFixed(1)),
        averageCycleDays: Math.round(avgCycleDays),
        recommendation: "Increase site visits in week 1 to match top performers."
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getDigitalTwin = async (req, res, next) => {
  try {
    const { _tenantId } = getTenantAndUser(req);
    res.json({
      success: true,
      data: {
        nodes: [{ id: 'new', label: 'New Leads' }, { id: 'meeting', label: 'In Meeting' }],
        edges: [{ source: 'new', target: 'meeting', value: 45 }],
        bottleneck: "meeting"
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getCommandCenter = async (req, res, next) => {
  try {
    const { _tenantId } = getTenantAndUser(req);
    res.json({
      success: true,
      data: {
        status: "Critical",
        insights: [
          "Pipeline value is 15% below target for Q3.",
          "5 high-value leads are stalled in the Quotation stage.",
        ],
        actions: [
          { action: "Launch discount campaign", impact: "High" }
        ]
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getReferralCandidates = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    // Find won leads with high sentiment or score
    const { rows } = await pool.query(
      `SELECT id, name, email, score 
       FROM leads 
       WHERE tenant_id = $1 AND status = 'won' AND score > 80
       ORDER BY score DESC LIMIT 10`,
      [tenantId]
    );
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.getDailyRevenuePlan = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    // Find high-probability deals that have tasks due today or no future tasks
    const { rows } = await pool.query(
      `SELECT id, name, budget_max, win_probability, score
       FROM leads 
       WHERE tenant_id = $1 AND status NOT IN ('won', 'lost', 'archived') 
         AND score > 70 AND win_probability > 50
       ORDER BY win_probability DESC LIMIT 5`,
      [tenantId]
    );

    const totalPotential = rows.reduce((sum, lead) => sum + (lead.budget_max || 0), 0);

    res.json({
      success: true,
      data: {
        message: `Today's potential revenue focus: ₹${totalPotential.toLocaleString()}`,
        top_priorities: rows
      }
    });
  } catch (error) {
    next(error);
  }
};
