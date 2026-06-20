const pool = require('../db/pool');

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
  
  if (req.query.from) from.setTime(new Date(req.query.from).getTime());
  if (req.query.to) to.setTime(new Date(req.query.to).getTime());
  
  return { from, to };
};

exports.getRevenueAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    
    // Revenue collected vs projected by month
    const { rows } = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', due_date), 'YYYY-MM') as month,
        SUM(amount) as projected,
        SUM(paid_amount) as collected
      FROM payment_milestones pm
      JOIN projects p ON pm.project_id = p.id
      WHERE p.tenant_id = $1 AND pm.due_date >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', due_date)
      ORDER BY DATE_TRUNC('month', due_date) ASC
    `, [tenantId]);
    
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.getPipelineAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    
    // Value of pipeline by stage
    const { rows } = await pool.query(`
      SELECT 
        ls.name as stage_name,
        COUNT(l.id) as count,
        SUM(l.budget_max) as total_value
      FROM lead_stages ls
      LEFT JOIN leads l ON l.stage_id = ls.id AND l.tenant_id = $1 AND l.status = 'active'
      WHERE ls.tenant_id = $1
      GROUP BY ls.name, ls.sort_order
      ORDER BY ls.sort_order ASC
    `, [tenantId]);
    
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};

exports.getConversionAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const { from, to } = getDates(req);
    
    const { rows } = await pool.query(`
      SELECT 
        COUNT(id) as total_leads,
        COUNT(id) FILTER (WHERE status = 'won') as won_leads,
        COUNT(id) FILTER (WHERE status = 'lost') as lost_leads
      FROM leads
      WHERE tenant_id = $1 AND created_at BETWEEN $2 AND $3
    `, [tenantId, from, to]);
    
    const stats = rows[0];
    const total = parseInt(stats.total_leads, 10);
    const won = parseInt(stats.won_leads, 10);
    const rate = total > 0 ? ((won / total) * 100).toFixed(2) : 0;
    
    res.json({ success: true, data: { ...stats, conversion_rate: parseFloat(rate) } });
  } catch (error) {
    next(error);
  }
};

exports.getForecastAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    
    // Very simple forecast based on win probability applied to budget
    const { rows } = await pool.query(`
      SELECT 
        TO_CHAR(DATE_TRUNC('month', NOW() + INTERVAL '1 month' * series.number), 'YYYY-MM') as month,
        SUM(l.budget_max * (l.win_probability / 100.0)) as forecasted_revenue
      FROM leads l
      CROSS JOIN generate_series(0, 3) as series(number)
      WHERE l.tenant_id = $1 AND l.status = 'active' AND l.win_probability > 0
      GROUP BY series.number
      ORDER BY series.number ASC
    `, [tenantId]);
    
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
};
