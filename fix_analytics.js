const fs = require('fs');
const path = require('path');

const analyticsPath = path.join(__dirname, 'server', 'src', 'routes', 'analytics.js');
let content = fs.readFileSync(analyticsPath, 'utf8');

// The file got severely corrupted around the end of the composite /leads route.
// Let's find the reliable part.
const indexCompositeEnd = content.indexOf(`        timeSeries: [] // Mock or implement if necessary`);

if (indexCompositeEnd !== -1) {
  const indexSourceRest = content.indexOf(`    const query = \`\n      SELECT \n        l.source, \n        COUNT(l.id) as count, `);
  
  if (indexSourceRest !== -1) {
    const goodStart = content.substring(0, indexCompositeEnd + `        timeSeries: [] // Mock or implement if necessary\n      }\n    });\n`.length);
    const goodEnd = content.substring(indexSourceRest);
    
    const missingContent = `  } catch (error) {
    logger.error('Composite /leads error:', error);
    return fail(res, 'SERVER_ERROR', 'Failed to fetch lead analytics', 500);
  }
});

router.get('/revenue-leads', async (req, res, next) => {
  // Graceful fallback for revenue analytics, return an empty structure
  res.json({
    success: true,
    data: {
      kpis: {
        totalPipeline: { val: '$0', trend: 0 },
        wonRevenue: { val: '$0', trend: 0 },
        lostRevenue: { val: '$0', trend: 0 },
        expectedRevenue: { val: '$0', trend: 0 },
        avgDealSize: { val: '$0', trend: 0 },
        largestDeal: { val: '$0', trend: 0 },
      },
      stageRevenue: [],
      sourceRevenue: [],
      monthlyTrend: [],
      drillDownLeads: []
    }
  });
});

// 1. GET /api/analytics/leads/summary
router.get('/leads/summary', async (req, res, next) => {
  try {
    const { from, to } = getDates(req);
    const tenantId = req.tenantId;
    const userRole = req.user?.role;
    
    const isGlobal = userRole === 'superadmin' || userRole === 'admin' || (typeof userRole === 'object' && (userRole?.name?.toLowerCase() === 'superadmin' || userRole?.name?.toLowerCase() === 'super admin' || userRole?.name?.toLowerCase() === 'admin'));
    const assigneeFilter = isGlobal ? '' : \`AND (l.assignee_id=$4 OR l.assignee_id IS NULL)\`;
    const params = [tenantId, from.toISOString(), to.toISOString()];
    if (!isGlobal) params.push(req.user.id);

    const query = \`
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
      WHERE l.tenant_id = $1 AND l.deleted_at IS NULL AND l.created_at BETWEEN $2 AND $3 \${assigneeFilter}
    \`;
    const result = await pool.query(query, params);
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
  } catch (error) {
    return next(error);
  }
});

// 2. GET /api/analytics/leads/funnel
router.get('/leads/funnel', async (req, res, next) => {
  try {
    const { from, to } = getDates(req);
    const tenantId = req.tenantId;
    const query = \`
      SELECT ls.name as stage, COUNT(l.id) as count 
      FROM leads l
      LEFT JOIN lead_stages ls ON l.stage_id = ls.id
      WHERE l.tenant_id = $1 AND l.created_at BETWEEN $2 AND $3 AND ls.name IS NOT NULL
      GROUP BY ls.name, ls.sort_order
      ORDER BY ls.sort_order ASC
    \`;
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
  } catch (error) {
    return next(error);
  }
});

// 3. GET /api/analytics/leads/by_source
router.get('/leads/by_source', async (req, res, next) => {
  try {
    const { from, to } = getDates(req);
`;

    fs.writeFileSync(analyticsPath, goodStart + missingContent + goodEnd);
    console.log('Fixed analytics.js');
  } else {
    console.log('Source rest not found');
  }
} else {
  console.log('Composite end not found');
}
