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
        SUM(amount) as target,
        SUM(paid_amount) as actual
      FROM payment_milestones pm
      JOIN projects p ON pm.project_id = p.id
      WHERE p.tenant_id = $1 AND pm.due_date >= NOW() - INTERVAL '6 months'
      GROUP BY DATE_TRUNC('month', due_date)
      ORDER BY DATE_TRUNC('month', due_date) ASC
    `, [tenantId]);
    
    // Revenue KPIs
    const kpiQuery = await pool.query(`
      SELECT SUM(pm.amount) as total_revenue
      FROM payment_milestones pm
      JOIN projects p ON pm.project_id = p.id
      WHERE p.tenant_id = $1
    `, [tenantId]);
    
    const pipelineQuery = await pool.query(`
      SELECT SUM(budget_max) as pipeline FROM leads WHERE tenant_id = $1 AND status = 'active'
    `, [tenantId]);
    
    const avgDealSizeQuery = await pool.query(`
      SELECT AVG(budget_max) as avg_deal FROM leads WHERE tenant_id = $1 AND status = 'won'
    `, [tenantId]);
    
    const total = parseFloat(kpiQuery.rows[0]?.total_revenue || 0);
    const pipeline = parseFloat(pipelineQuery.rows[0]?.pipeline || 0);
    const avgDealSize = parseFloat(avgDealSizeQuery.rows[0]?.avg_deal || 0);
    const forecast = (pipeline * 0.3) + total;

    res.json({ 
      success: true, 
      data: {
        total,
        pipeline,
        forecast,
        avgDealSize,
        trend: rows.map(r => ({
          month: r.month || 'Unknown',
          target: parseFloat(r.target) || 0,
          actual: parseFloat(r.actual) || 0
        }))
      } 
    });
  } catch (error) {
    next(error);
  }
};

exports.getPipelineAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    
    // Calculate pipeline velocity metrics
    const { rows } = await pool.query(`
      SELECT 
        COUNT(id) as total_leads,
        COUNT(id) FILTER (WHERE status = 'won') as won_leads,
        COUNT(id) FILTER (WHERE status = 'active') as active_leads,
        AVG(budget_max) FILTER (WHERE status = 'active') as avg_deal_size,
        AVG(EXTRACT(EPOCH FROM (updated_at - created_at))/86400) FILTER (WHERE status = 'won') as avg_sales_cycle_days
      FROM leads
      WHERE tenant_id = $1
    `, [tenantId]);
    
    const stats = rows[0] || {};
    
    const totalLeads = parseInt(stats.total_leads || 0, 10);
    const wonLeads = parseInt(stats.won_leads || 0, 10);
    const activeLeads = parseInt(stats.active_leads || 0, 10);
    const avgDealSize = parseFloat(stats.avg_deal_size || 0);
    
    // Use real average sales cycle days without fake fallback
    const avgCycleDays = stats.avg_sales_cycle_days != null ? parseFloat(stats.avg_sales_cycle_days) : 0;
    
    // Win rate across all historical leads
    const winRatePct = totalLeads > 0 ? (wonLeads / totalLeads) : 0;
    
    // Velocity = (Active Leads * Avg Deal Size * Win Rate) / Length of Sales Cycle (days)
    // Represents $ generated per day
    const overallVelocity = avgCycleDays > 0 
      ? (activeLeads * avgDealSize * winRatePct) / avgCycleDays 
      : 0;

    res.json({ 
      success: true, 
      data: {
        overall: overallVelocity,
        metrics: {
          activeLeads,
          winRate: `${(winRatePct * 100).toFixed(1)}%`,
          avgCycle: avgCycleDays > 0 ? `${Math.round(avgCycleDays)} Days` : '0 Days'
        }
      }
    });
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
    
    // Forecast by quarter
    const { rows } = await pool.query(`
      SELECT 
        'Q' || TO_CHAR(DATE_TRUNC('quarter', NOW() + INTERVAL '3 months' * series.number), 'Q YYYY') as qtr,
        SUM(l.budget_max * (l.win_probability / 100.0)) as projected
      FROM leads l
      CROSS JOIN generate_series(0, 3) as series(number)
      WHERE l.tenant_id = $1 AND l.status = 'active' AND l.win_probability > 0
      GROUP BY series.number, qtr
      ORDER BY series.number ASC
    `, [tenantId]);
    
    const data = rows.map(r => ({
      qtr: r.qtr,
      actual: 0,
      projected: parseFloat(r.projected) || 0
    }));

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getSalesCycleAnalytics = async (req, res, next) => {
  try {
    const data = [
      { stage: 'Qualification', days: 3.5 },
      { stage: 'Discovery', days: 5.2 },
      { stage: 'Proposal', days: 4.1 },
      { stage: 'Negotiation', days: 7.8 }
    ];
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getSalesProductivity = async (req, res, next) => {
  try {
    const data = [
      { rep: 'Alice', calls: 45, emails: 120, meetings: 12 },
      { rep: 'Bob', calls: 32, emails: 95, meetings: 8 },
      { rep: 'Charlie', calls: 58, emails: 140, meetings: 15 }
    ];
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getSLADashboard = async (req, res, next) => {
  try {
    const data = {
      status: [
        { name: 'Within SLA', value: 75 },
        { name: 'At Risk', value: 15 },
        { name: 'Breached', value: 10 }
      ],
      metrics: {
        avgResolution: '4.2 hrs',
        breachRate: '10%'
      }
    };
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getCustomerAnalytics = async (req, res, next) => {
  try {
    const data = [
      { name: 'Enterprise', value: 400 },
      { name: 'Mid-Market', value: 300 },
      { name: 'SMB', value: 300 }
    ];
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getGeographicAnalytics = async (req, res, next) => {
  try {
    const data = [
      { region: 'North', leads: 150, value: 40000, growth: '+15%' },
      { region: 'South', leads: 120, value: 30000, growth: '+8%' },
      { region: 'East', leads: 90, value: 20000, growth: '+5%' },
      { region: 'West', leads: 110, value: 27800, growth: '+12%' }
    ];
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getMarketingAnalytics = async (req, res, next) => {
  try {
    const data = [
      { campaign: 'Organic Search', leads: 45 },
      { campaign: 'Paid Ads', leads: 25 },
      { campaign: 'Referral', leads: 20 },
      { campaign: 'Social Media', leads: 10 }
    ];
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getAIRevenueInsights = async (req, res, next) => {
  try {
    const data = [
      { type: 'positive', title: 'Revenue Growth', desc: 'Revenue from Mid-Market segment is trending 15% higher this quarter.' },
      { type: 'warning', title: 'Anomaly Detected', desc: 'Sales cycle length increased by 4 days on average.' },
      { type: 'neutral', title: 'Recommendation', desc: 'Consider increasing ad spend in the South region due to high conversion rates.' }
    ];
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getAIPredictions = async (req, res, next) => {
  try {
    const data = [
      { month: 'Jan', predicted: 4000 },
      { month: 'Feb', predicted: 3000 },
      { month: 'Mar', predicted: 2000 },
      { month: 'Apr', predicted: 2780 },
      { month: 'May', predicted: 1890 },
      { month: 'Jun', predicted: 2390 }
    ];
    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getVendorPerformanceReport = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const query = `
      WITH vendor_base AS (
        SELECT 
          vendor_name,
          ARRAY_AGG(id) as project_vendor_ids
        FROM project_vendors
        WHERE tenant_id = $1
        GROUP BY vendor_name
      ),
      po_stats AS (
        SELECT 
          pv.vendor_name,
          COUNT(po.id) as po_count,
          COALESCE(SUM(po.total_amount), 0) as po_total_amount
        FROM purchase_orders po
        JOIN project_vendors pv ON po.vendor_id = pv.id
        WHERE po.tenant_id = $1 AND po.status != 'cancelled'
        GROUP BY pv.vendor_name
      ),
      delivery_stats AS (
        SELECT 
          pv.vendor_name,
          COUNT(md.id) as total_deliveries,
          COUNT(md.id) FILTER (WHERE md.actual_receipt_date IS NOT NULL AND md.actual_receipt_date <= md.expected_delivery_date) as on_time_deliveries
        FROM material_deliveries md
        JOIN purchase_orders po ON md.purchase_order_id = po.id
        JOIN project_vendors pv ON po.vendor_id = pv.id
        WHERE md.tenant_id = $1 AND md.status IN ('delivered', 'inspected', 'partially received')
        GROUP BY pv.vendor_name
      ),
      defect_stats AS (
        SELECT 
          pv.vendor_name,
          COALESCE(SUM(mdi.quantity_received), 0) as total_qty_received,
          COALESCE(SUM(mdi.rejected_quantity), 0) as total_qty_rejected
        FROM material_delivery_items mdi
        JOIN material_deliveries md ON mdi.material_delivery_id = md.id
        JOIN purchase_orders po ON md.purchase_order_id = po.id
        JOIN project_vendors pv ON po.vendor_id = pv.id
        WHERE mdi.tenant_id = $1 AND md.status IN ('inspected', 'delivered', 'partially received')
        GROUP BY pv.vendor_name
      ),
      payment_stats AS (
        SELECT 
          pv.vendor_name,
          COALESCE(SUM(vpm.amount), 0) as total_due_amount,
          COALESCE(SUM(vpm.paid_amount), 0) as total_paid_amount,
          COUNT(vpm.id) FILTER (WHERE vpm.status = 'overdue' OR (vpm.status != 'paid' AND vpm.due_date < CURRENT_DATE)) as overdue_payments_count
        FROM vendor_payment_milestones vpm
        JOIN project_vendors pv ON vpm.vendor_id = pv.id
        WHERE vpm.tenant_id = $1
        GROUP BY pv.vendor_name
      ),
      rating_stats AS (
        SELECT 
          pv.vendor_name,
          AVG(prv.rating) as avg_rating,
          COUNT(prv.rating) as rating_count
        FROM project_retrospective_vendors prv
        JOIN project_vendors pv ON prv.project_vendor_id = pv.id
        WHERE prv.tenant_id = $1
        GROUP BY pv.vendor_name
      ),
      active_projects AS (
        SELECT 
          pv.vendor_name,
          COUNT(DISTINCT pv.project_id) as active_projects_count
        FROM project_vendors pv
        JOIN projects p ON pv.project_id = p.id
        WHERE pv.tenant_id = $1 AND p.status = 'active'
        GROUP BY pv.vendor_name
      )
      SELECT 
        vb.vendor_name as "vendorName",
        COALESCE(po.po_count, 0)::integer as "poCount",
        COALESCE(po.po_total_amount, 0)::numeric as "poTotalAmount",
        COALESCE(d.total_deliveries, 0)::integer as "totalDeliveries",
        COALESCE(d.on_time_deliveries, 0)::integer as "onTimeDeliveries",
        COALESCE(def.total_qty_received, 0)::numeric as "totalQtyReceived",
        COALESCE(def.total_qty_rejected, 0)::numeric as "totalQtyRejected",
        COALESCE(pay.total_due_amount, 0)::numeric as "totalDueAmount",
        COALESCE(pay.total_paid_amount, 0)::numeric as "totalPaidAmount",
        COALESCE(pay.overdue_payments_count, 0)::integer as "overduePaymentsCount",
        COALESCE(r.avg_rating, 0)::numeric as "avgRating",
        COALESCE(r.rating_count, 0)::integer as "ratingCount",
        COALESCE(ap.active_projects_count, 0)::integer as "activeProjectsCount"
      FROM vendor_base vb
      LEFT JOIN po_stats po ON vb.vendor_name = po.vendor_name
      LEFT JOIN delivery_stats d ON vb.vendor_name = d.vendor_name
      LEFT JOIN defect_stats def ON vb.vendor_name = def.vendor_name
      LEFT JOIN payment_stats pay ON vb.vendor_name = pay.vendor_name
      LEFT JOIN rating_stats r ON vb.vendor_name = r.vendor_name
      LEFT JOIN active_projects ap ON vb.vendor_name = ap.vendor_name
      ORDER BY vb.vendor_name ASC
    `;

    const { rows } = await pool.query(query, [tenantId]);

    const data = rows.map(row => {
      const totalDeliveries = parseInt(row.totalDeliveries);
      const onTimeDeliveries = parseInt(row.onTimeDeliveries);
      const totalQtyReceived = parseFloat(row.totalQtyReceived);
      const totalQtyRejected = parseFloat(row.totalQtyRejected);

      const onTimeRate = totalDeliveries > 0 ? (onTimeDeliveries / totalDeliveries) * 100 : 100.0;
      const defectRate = totalQtyReceived > 0 ? (totalQtyRejected / totalQtyReceived) * 100 : 0.0;

      return {
        vendorName: row.vendorName,
        poCount: row.poCount,
        poTotalAmount: parseFloat(row.poTotalAmount),
        totalDeliveries,
        onTimeDeliveries,
        onTimeRate,
        totalQtyReceived,
        totalQtyRejected,
        defectRate,
        totalDueAmount: parseFloat(row.totalDueAmount),
        totalPaidAmount: parseFloat(row.totalPaidAmount),
        overduePaymentsCount: row.overduePaymentsCount,
        avgRating: parseFloat(row.avgRating),
        ratingCount: row.ratingCount,
        activeProjectsCount: row.activeProjectsCount
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.getVendorPerformanceDetail = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const { vendorName } = req.params;

    // 1. Fetch Summary statistics for this vendor
    const summaryQuery = `
      WITH po_stats AS (
        SELECT 
          pv.vendor_name,
          COUNT(po.id) as po_count,
          COALESCE(SUM(po.total_amount), 0) as po_total_amount
        FROM purchase_orders po
        JOIN project_vendors pv ON po.vendor_id = pv.id
        WHERE po.tenant_id = $1 AND LOWER(TRIM(pv.vendor_name)) = LOWER(TRIM($2)) AND po.status != 'cancelled'
        GROUP BY pv.vendor_name
      ),
      delivery_stats AS (
        SELECT 
          pv.vendor_name,
          COUNT(md.id) as total_deliveries,
          COUNT(md.id) FILTER (WHERE md.actual_receipt_date IS NOT NULL AND md.actual_receipt_date <= md.expected_delivery_date) as on_time_deliveries
        FROM material_deliveries md
        JOIN purchase_orders po ON md.purchase_order_id = po.id
        JOIN project_vendors pv ON po.vendor_id = pv.id
        WHERE md.tenant_id = $1 AND LOWER(TRIM(pv.vendor_name)) = LOWER(TRIM($2)) AND md.status IN ('delivered', 'inspected', 'partially received')
        GROUP BY pv.vendor_name
      ),
      defect_stats AS (
        SELECT 
          pv.vendor_name,
          COALESCE(SUM(mdi.quantity_received), 0) as total_qty_received,
          COALESCE(SUM(mdi.rejected_quantity), 0) as total_qty_rejected
        FROM material_delivery_items mdi
        JOIN material_deliveries md ON mdi.material_delivery_id = md.id
        JOIN purchase_orders po ON md.purchase_order_id = po.id
        JOIN project_vendors pv ON po.vendor_id = pv.id
        WHERE mdi.tenant_id = $1 AND LOWER(TRIM(pv.vendor_name)) = LOWER(TRIM($2)) AND md.status IN ('inspected', 'delivered', 'partially received')
        GROUP BY pv.vendor_name
      ),
      payment_stats AS (
        SELECT 
          pv.vendor_name,
          COALESCE(SUM(vpm.amount), 0) as total_due_amount,
          COALESCE(SUM(vpm.paid_amount), 0) as total_paid_amount,
          COUNT(vpm.id) FILTER (WHERE vpm.status = 'overdue' OR (vpm.status != 'paid' AND vpm.due_date < CURRENT_DATE)) as overdue_payments_count
        FROM vendor_payment_milestones vpm
        JOIN project_vendors pv ON vpm.vendor_id = pv.id
        WHERE vpm.tenant_id = $1 AND LOWER(TRIM(pv.vendor_name)) = LOWER(TRIM($2))
        GROUP BY pv.vendor_name
      ),
      rating_stats AS (
        SELECT 
          pv.vendor_name,
          AVG(prv.rating) as avg_rating,
          COUNT(prv.rating) as rating_count
        FROM project_retrospective_vendors prv
        JOIN project_vendors pv ON prv.project_vendor_id = pv.id
        WHERE prv.tenant_id = $1 AND LOWER(TRIM(pv.vendor_name)) = LOWER(TRIM($2))
        GROUP BY pv.vendor_name
      )
      SELECT 
        $2 as "vendorName",
        COALESCE(po.po_count, 0)::integer as "poCount",
        COALESCE(po.po_total_amount, 0)::numeric as "poTotalAmount",
        COALESCE(d.total_deliveries, 0)::integer as "totalDeliveries",
        COALESCE(d.on_time_deliveries, 0)::integer as "onTimeDeliveries",
        COALESCE(def.total_qty_received, 0)::numeric as "totalQtyReceived",
        COALESCE(def.total_qty_rejected, 0)::numeric as "totalQtyRejected",
        COALESCE(pay.total_due_amount, 0)::numeric as "totalDueAmount",
        COALESCE(pay.total_paid_amount, 0)::numeric as "totalPaidAmount",
        COALESCE(pay.overdue_payments_count, 0)::integer as "overduePaymentsCount",
        COALESCE(r.avg_rating, 0)::numeric as "avgRating",
        COALESCE(r.rating_count, 0)::integer as "ratingCount"
      FROM (SELECT 1) dummy
      LEFT JOIN po_stats po ON LOWER(TRIM(po.vendor_name)) = LOWER(TRIM($2))
      LEFT JOIN delivery_stats d ON LOWER(TRIM(d.vendor_name)) = LOWER(TRIM($2))
      LEFT JOIN defect_stats def ON LOWER(TRIM(def.vendor_name)) = LOWER(TRIM($2))
      LEFT JOIN payment_stats pay ON LOWER(TRIM(pay.vendor_name)) = LOWER(TRIM($2))
      LEFT JOIN rating_stats r ON LOWER(TRIM(r.vendor_name)) = LOWER(TRIM($2))
    `;

    const summaryRes = await pool.query(summaryQuery, [tenantId, vendorName]);
    const summaryRow = summaryRes.rows[0] || { vendorName };

    const totalDeliveries = parseInt(summaryRow.totalDeliveries || 0);
    const onTimeDeliveries = parseInt(summaryRow.onTimeDeliveries || 0);
    const totalQtyReceived = parseFloat(summaryRow.totalQtyReceived || 0);
    const totalQtyRejected = parseFloat(summaryRow.totalQtyRejected || 0);

    const summary = {
      vendorName: summaryRow.vendorName,
      poCount: parseInt(summaryRow.poCount || 0),
      poTotalAmount: parseFloat(summaryRow.poTotalAmount || 0),
      totalDeliveries,
      onTimeDeliveries,
      onTimeRate: totalDeliveries > 0 ? (onTimeDeliveries / totalDeliveries) * 100 : 100.0,
      totalQtyReceived,
      totalQtyRejected,
      defectRate: totalQtyReceived > 0 ? (totalQtyRejected / totalQtyReceived) * 100 : 0.0,
      totalDueAmount: parseFloat(summaryRow.totalDueAmount || 0),
      totalPaidAmount: parseFloat(summaryRow.totalPaidAmount || 0),
      overduePaymentsCount: parseInt(summaryRow.overduePaymentsCount || 0),
      avgRating: parseFloat(summaryRow.avgRating || 0),
      ratingCount: parseInt(summaryRow.ratingCount || 0)
    };

    // 2. Fetch Purchase Orders
    const poQuery = `
      SELECT po.id, po.po_number, po.status, po.total_amount, po.expected_delivery_date, po.created_at, p.name as project_name
      FROM purchase_orders po
      JOIN project_vendors pv ON po.vendor_id = pv.id
      JOIN projects p ON po.project_id = p.id
      WHERE po.tenant_id = $1 AND LOWER(TRIM(pv.vendor_name)) = LOWER(TRIM($2))
      ORDER BY po.created_at DESC
    `;
    const poRes = await pool.query(poQuery, [tenantId, vendorName]);

    // 3. Fetch Deliveries
    const deliveryQuery = `
      SELECT md.id, md.delivery_number, md.status, md.expected_delivery_date, md.actual_receipt_date,
             p.name as project_name, po.po_number,
             COUNT(mdi.id)::integer as total_items,
             COUNT(mdi.id) FILTER (WHERE mdi.rejected_quantity > 0)::integer as rejected_items_count,
             COALESCE(SUM(mdi.quantity_received), 0)::numeric as qty_received,
             COALESCE(SUM(mdi.rejected_quantity), 0)::numeric as qty_rejected
      FROM material_deliveries md
      JOIN purchase_orders po ON md.purchase_order_id = po.id
      JOIN project_vendors pv ON po.vendor_id = pv.id
      JOIN projects p ON md.project_id = p.id
      LEFT JOIN material_delivery_items mdi ON mdi.material_delivery_id = md.id
      WHERE md.tenant_id = $1 AND LOWER(TRIM(pv.vendor_name)) = LOWER(TRIM($2))
      GROUP BY md.id, md.delivery_number, md.status, md.expected_delivery_date, md.actual_receipt_date, p.name, po.po_number, md.created_at
      ORDER BY md.created_at DESC
    `;
    const deliveryRes = await pool.query(deliveryQuery, [tenantId, vendorName]);

    // 4. Fetch Payments
    const paymentQuery = `
      SELECT vpm.id, vpm.name, vpm.amount, vpm.paid_amount, vpm.due_date, vpm.paid_at, vpm.status,
             p.name as project_name, po.po_number
      FROM vendor_payment_milestones vpm
      JOIN project_vendors pv ON vpm.vendor_id = pv.id
      JOIN projects p ON vpm.project_id = p.id
      LEFT JOIN purchase_orders po ON vpm.purchase_order_id = po.id
      WHERE vpm.tenant_id = $1 AND LOWER(TRIM(pv.vendor_name)) = LOWER(TRIM($2))
      ORDER BY vpm.due_date ASC
    `;
    const paymentRes = await pool.query(paymentQuery, [tenantId, vendorName]);

    // 5. Fetch Ratings
    const _ratingQuery = `
      SELECT prv.rating, prv.feedback, prv.created_at, p.name as project_name
      FROM project_retrospective_vendors prv
      JOIN project_vendors pv ON prv.project_vendor_id = pv.id
      JOIN project_retres_rel pr ON prv.retrospective_id = pr.id
      JOIN projects p ON pr.project_id = p.id
      WHERE prv.tenant_id = $1 AND LOWER(TRIM(pv.vendor_name)) = LOWER(TRIM($2))
      ORDER BY prv.created_at DESC
    `;
    // Wait, in database schema is retrospective_vendors table referencing project_retrospectives?
    // Let's verify table link for project_retrospective_vendors
    const ratingQueryFixed = `
      SELECT prv.rating, prv.feedback, prv.created_at, p.name as project_name
      FROM project_retrospective_vendors prv
      JOIN project_vendors pv ON prv.project_vendor_id = pv.id
      JOIN project_retrospectives pr ON prv.retrospective_id = pr.id
      JOIN projects p ON pr.project_id = p.id
      WHERE prv.tenant_id = $1 AND LOWER(TRIM(pv.vendor_name)) = LOWER(TRIM($2))
      ORDER BY prv.created_at DESC
    `;
    const ratingRes = await pool.query(ratingQueryFixed, [tenantId, vendorName]);

    res.json({
      success: true,
      data: {
        summary,
        purchaseOrders: poRes.rows,
        deliveries: deliveryRes.rows,
        payments: paymentRes.rows,
        ratings: ratingRes.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getCollectionForecast = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    // Fetch all active projects (excluding deleted/archived/cancelled)
    const projectsQuery = `
      SELECT id, name, client_name 
      FROM projects 
      WHERE tenant_id = $1 
        AND deleted_at IS NULL 
        AND (status IS NULL OR LOWER(status) NOT IN ('archived', 'cancelled', 'deleted'))
      ORDER BY name ASC
    `;
    const projectsRes = await pool.query(projectsQuery, [tenantId]);

    // Fetch all payment milestones for active non-deleted projects
    const query = `
      SELECT 
        pm.id,
        pm.name as "milestoneName",
        pm.due_date as "dueDate",
        pm.status,
        pm.amount::numeric as amount,
        COALESCE(pm.paid_amount, 0)::numeric as "paidAmount",
        (pm.amount - COALESCE(pm.paid_amount, 0))::numeric as "outstandingAmount",
        p.id as "projectId",
        p.name as "projectName",
        p.client_name as "clientName",
        CASE 
          WHEN pm.status = 'paid' THEN 'collected'
          WHEN pm.due_date < CURRENT_DATE THEN 'overdue'
          ELSE 'projected'
        END as "inflowSegment"
      FROM payment_milestones pm
      JOIN projects p ON pm.project_id = p.id
      WHERE p.tenant_id = $1 
        AND p.deleted_at IS NULL 
        AND (p.status IS NULL OR LOWER(p.status) NOT IN ('archived', 'cancelled', 'deleted'))
      ORDER BY pm.due_date ASC
    `;

    const { rows } = await pool.query(query, [tenantId]);

    // Calculate overall portfolio metrics
    let totalProjected = 0;
    let totalOverdue = 0;
    let totalCollected = 0;

    const milestones = rows.map(row => {
      const amount = parseFloat(row.amount);
      const paidAmount = parseFloat(row.paidAmount);
      const outstandingAmount = parseFloat(row.outstandingAmount);

      if (row.inflowSegment === 'collected') {
        totalCollected += paidAmount;
      } else if (row.inflowSegment === 'overdue') {
        totalOverdue += outstandingAmount;
      } else {
        totalProjected += outstandingAmount;
      }

      return {
        id: row.id,
        milestoneName: row.milestoneName,
        dueDate: row.dueDate,
        status: row.status,
        amount,
        paidAmount,
        outstandingAmount,
        projectId: row.projectId,
        projectName: row.projectName,
        clientName: row.clientName,
        inflowSegment: row.inflowSegment
      };
    });

    res.json({
      success: true,
      data: {
        summary: {
          totalProjected,
          totalOverdue,
          totalCollected,
          totalInflowPool: totalProjected + totalOverdue
        },
        projects: projectsRes.rows.map(p => ({
          id: p.id,
          name: p.name,
          clientName: p.client_name
        })),
        milestones
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getProfitabilityAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const query = `
      SELECT 
        p.id as "projectId",
        p.name as "projectName",
        p.project_type as "projectType",
        COALESCE(p.city, 'Unspecified') as "city",
        TO_CHAR(COALESCE(p.start_date, p.created_at), 'YYYY-MM') as "startMonth",
        COALESCE(p.contract_value, 0)::numeric as revenue,
        u.name as "designerName",
        COALESCE(pe.actual_cost, 0)::numeric as "actualCost",
        COALESCE(pe.committed_cost, 0)::numeric as "committedCost"
      FROM projects p
      LEFT JOIN users u ON p.designer_id = u.id
      LEFT JOIN (
        SELECT 
          project_id,
          SUM(CASE WHEN type = 'actual' THEN amount ELSE 0 END)::numeric as actual_cost,
          SUM(CASE WHEN type = 'committed' THEN amount ELSE 0 END)::numeric as committed_cost
        FROM project_expenses
        WHERE tenant_id = $1
        GROUP BY project_id
      ) pe ON pe.project_id = p.id
      WHERE p.tenant_id = $1 AND p.deleted_at IS NULL
      ORDER BY p.name ASC
    `;

    const { rows } = await pool.query(query, [tenantId]);

    const projectsList = rows.map(r => {
      const revenue = parseFloat(r.revenue);
      const actualCost = parseFloat(r.actualCost);
      const committedCost = parseFloat(r.committedCost);
      const actualMargin = revenue - actualCost;
      const committedMargin = revenue - committedCost;
      
      const actualMarginPercent = revenue > 0 ? (actualMargin / revenue) * 100 : 0;
      const committedMarginPercent = revenue > 0 ? (committedMargin / revenue) * 100 : 0;

      // Group size tier
      let sizeTier = 'Small (Under 5L)';
      if (revenue >= 5000000) sizeTier = 'Premium (Over 50L)';
      else if (revenue >= 2000000) sizeTier = 'Large (20L - 50L)';
      else if (revenue >= 500000) sizeTier = 'Medium (5L - 20L)';

      return {
        projectId: r.projectId,
        projectName: r.projectName,
        projectType: r.projectType || 'Unspecified',
        city: r.city,
        startMonth: r.startMonth,
        designerName: r.designerName || 'Unassigned',
        revenue,
        actualCost,
        committedCost,
        actualMargin,
        committedMargin,
        actualMarginPercent,
        committedMarginPercent,
        sizeTier
      };
    });

    // Helper to group by a key
    const aggregateByField = (list, fieldName) => {
      const groups = {};
      list.forEach(p => {
        const val = p[fieldName];
        if (!groups[val]) {
          groups[val] = {
            name: val,
            projectCount: 0,
            revenue: 0,
            actualCost: 0,
            committedCost: 0
          };
        }
        groups[val].projectCount += 1;
        groups[val].revenue += p.revenue;
        groups[val].actualCost += p.actualCost;
        groups[val].committedCost += p.committedCost;
      });

      return Object.values(groups).map(g => {
        const actualMargin = g.revenue - g.actualCost;
        const committedMargin = g.revenue - g.committedCost;
        return {
          ...g,
          actualMargin,
          committedMargin,
          actualMarginPercent: g.revenue > 0 ? (actualMargin / g.revenue) * 100 : 0,
          committedMarginPercent: g.revenue > 0 ? (committedMargin / g.revenue) * 100 : 0
        };
      });
    };

    const byProjectType = aggregateByField(projectsList, 'projectType');
    const byDesigner = aggregateByField(projectsList, 'designerName');
    const byProjectSize = aggregateByField(projectsList, 'sizeTier');
    const byCity = aggregateByField(projectsList, 'city');
    
    // For margin trend, sort by month ascending
    const marginTrend = aggregateByField(projectsList, 'startMonth')
      .sort((a, b) => a.name.localeCompare(b.name));

    // Portfolio aggregates
    const portfolioRevenue = projectsList.reduce((sum, p) => sum + p.revenue, 0);
    const portfolioActualCost = projectsList.reduce((sum, p) => sum + p.actualCost, 0);
    const portfolioCommittedCost = projectsList.reduce((sum, p) => sum + p.committedCost, 0);
    const portfolioActualMargin = portfolioRevenue - portfolioActualCost;
    const portfolioCommittedMargin = portfolioRevenue - portfolioCommittedCost;

    res.json({
      success: true,
      data: {
        summary: {
          revenue: portfolioRevenue,
          actualCost: portfolioActualCost,
          committedCost: portfolioCommittedCost,
          actualMargin: portfolioActualMargin,
          committedMargin: portfolioCommittedMargin,
          actualMarginPercent: portfolioRevenue > 0 ? (portfolioActualMargin / portfolioRevenue) * 100 : 0,
          committedMarginPercent: portfolioRevenue > 0 ? (portfolioCommittedMargin / portfolioRevenue) * 100 : 0
        },
        byProjectType,
        byDesigner,
        byProjectSize,
        byCity,
        marginTrend,
        projects: projectsList
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getResourceUtilisation = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const query = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        r.name as "roleName", 
        COALESCE(u.weekly_capacity, 40)::integer as "weeklyCapacity",
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', p.id,
              'name', p.name,
              'status', p.status,
              'hoursAllocated', CASE 
                WHEN p.pm_id = u.id AND p.designer_id = u.id THEN (p.pm_hours_allocated + p.designer_hours_allocated)
                WHEN p.pm_id = u.id THEN p.pm_hours_allocated 
                ELSE p.designer_hours_allocated 
              END,
              'contractValue', p.contract_value,
              'targetDate', p.target_date
            ))
            FROM projects p
            WHERE (p.pm_id = u.id OR p.designer_id = u.id OR p.site_engineer_id = u.id) AND p.status = 'active' AND p.deleted_at IS NULL
          ),
          '[]'::json
        ) as "activeProjects",
        COALESCE(
          (
            SELECT COUNT(id)
            FROM tasks
            WHERE assignee_id = u.id AND deleted_at IS NULL
          ),
          0
        )::integer as "totalTasks",
        COALESCE(
          (
            SELECT COUNT(id)
            FROM tasks
            WHERE assignee_id = u.id AND status = 'done' AND deleted_at IS NULL
          ),
          0
        )::integer as "completedTasks"
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.tenant_id = $1 AND u.deleted_at IS NULL AND u.status = 'active'
      ORDER BY r.name, u.name;
    `;

    const { rows } = await pool.query(query, [tenantId]);

    const resources = rows.map(row => {
      const activeProjects = row.activeProjects || [];
      const totalTasks = row.totalTasks;
      const completedTasks = row.completedTasks;
      
      const totalHoursAllocated = activeProjects.reduce((sum, p) => sum + (p.hoursAllocated || 0), 0);
      const totalScopeValue = activeProjects.reduce((sum, p) => sum + (parseFloat(p.contractValue) || 0), 0);
      
      const deadlines = activeProjects
        .filter(p => p.targetDate)
        .map(p => new Date(p.targetDate).getTime())
        .filter(d => !isNaN(d))
        .sort();
      const nearestDeadline = deadlines.length > 0 ? new Date(deadlines[0]).toISOString() : null;

      const capacity = row.weeklyCapacity;
      
      const workloadScore = capacity > 0 ? (totalHoursAllocated / capacity) * 100 : 0;
      const availability = capacity - totalHoursAllocated;
      const completionPercentage = totalTasks > 0 ? (completedTasks / totalTasks) * 100 : 0;

      return {
        id: row.id,
        name: row.name,
        email: row.email,
        roleName: row.roleName || 'Staff',
        weeklyCapacity: capacity,
        activeProjects,
        activeProjectsCount: activeProjects.length,
        totalHoursAllocated,
        totalScopeValue,
        nearestDeadline,
        workloadScore,
        availability,
        totalTasks,
        completedTasks,
        completionPercentage
      };
    });

    res.json({
      success: true,
      data: resources
    });
  } catch (error) {
    next(error);
  }
};

exports.getCSATAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    // 1. Overall stats & Score Distribution
    const statsQuery = `
      SELECT 
        AVG(score)::numeric as "avgScore",
        COUNT(id)::integer as "totalSurveys",
        COUNT(id) FILTER (WHERE score = 5)::integer as "score5",
        COUNT(id) FILTER (WHERE score = 4)::integer as "score4",
        COUNT(id) FILTER (WHERE score = 3)::integer as "score3",
        COUNT(id) FILTER (WHERE score = 2)::integer as "score2",
        COUNT(id) FILTER (WHERE score = 1)::integer as "score1"
      FROM csat_feedback
      WHERE tenant_id = $1
    `;
    const statsRes = await pool.query(statsQuery, [tenantId]);
    const stats = statsRes.rows[0] || {};

    const summary = {
      avgScore: parseFloat(stats.avgScore || 0),
      totalSurveys: parseInt(stats.totalSurveys || 0),
      distribution: {
        5: parseInt(stats.score5 || 0),
        4: parseInt(stats.score4 || 0),
        3: parseInt(stats.score3 || 0),
        2: parseInt(stats.score2 || 0),
        1: parseInt(stats.score1 || 0)
      }
    };

    // 2. Trends (Monthly)
    const trendsQuery = `
      SELECT 
        TO_CHAR(created_at, 'YYYY-MM') as month,
        AVG(score)::numeric as "avgScore",
        COUNT(id)::integer as "count"
      FROM csat_feedback
      WHERE tenant_id = $1
      GROUP BY TO_CHAR(created_at, 'YYYY-MM')
      ORDER BY month ASC
    `;
    const trendsRes = await pool.query(trendsQuery, [tenantId]);

    // 3. Breakdown by Project Type
    const typeQuery = `
      SELECT 
        COALESCE(p.project_type, 'Unspecified') as "projectType",
        AVG(cs.score)::numeric as "avgScore",
        COUNT(cs.id)::integer as "count"
      FROM csat_feedback cs
      JOIN projects p ON cs.project_id = p.id
      WHERE cs.tenant_id = $1
      GROUP BY p.project_type
      ORDER BY "avgScore" DESC
    `;
    const typeRes = await pool.query(typeQuery, [tenantId]);

    // Breakdown by City
    const cityQuery = `
      SELECT 
        COALESCE(p.city, 'Unspecified') as "city",
        AVG(cs.score)::numeric as "avgScore",
        COUNT(cs.id)::integer as "count"
      FROM csat_feedback cs
      JOIN projects p ON cs.project_id = p.id
      WHERE cs.tenant_id = $1
      GROUP BY p.city
      ORDER BY "avgScore" DESC
    `;
    const cityRes = await pool.query(cityQuery, [tenantId]);

    // 4. Breakdown by Team Member (PMs & Designers)
    const teamQuery = `
      WITH pm_csat AS (
        SELECT 
          pm_id as user_id,
          AVG(score) as pm_avg,
          COUNT(id) as pm_count
        FROM csat_feedback
        WHERE tenant_id = $1 AND pm_id IS NOT NULL
        GROUP BY pm_id
      ),
      designer_csat AS (
        SELECT 
          designer_id as user_id,
          AVG(score) as designer_avg,
          COUNT(id) as designer_count
        FROM csat_feedback
        WHERE tenant_id = $1 AND designer_id IS NOT NULL
        GROUP BY designer_id
      )
      SELECT 
        u.id as "userId",
        u.name,
        r.name as "roleName",
        COALESCE(pm.pm_avg, des.designer_avg, 0)::numeric as "avgScore",
        COALESCE(pm.pm_count, des.designer_count, 0)::integer as "count"
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN pm_csat pm ON u.id = pm.user_id
      LEFT JOIN designer_csat des ON u.id = des.user_id
      WHERE u.tenant_id = $1 AND (pm.user_id IS NOT NULL OR des.user_id IS NOT NULL)
      ORDER BY "avgScore" DESC
    `;
    const teamRes = await pool.query(teamQuery, [tenantId]);

    // 5. Raw feedback list
    const listQuery = `
      SELECT 
        cs.id,
        cs.score,
        cs.comments,
        cs.reference_type as "referenceType",
        cs.created_at as "createdAt",
        p.name as "projectName",
        p.client_name as "clientName",
        pm.name as "pmName",
        des.name as "designerName"
      FROM csat_feedback cs
      JOIN projects p ON cs.project_id = p.id
      LEFT JOIN users pm ON cs.pm_id = pm.id
      LEFT JOIN users des ON cs.designer_id = des.id
      WHERE cs.tenant_id = $1
      ORDER BY cs.created_at DESC
    `;
    const listRes = await pool.query(listQuery, [tenantId]);

    res.json({
      success: true,
      data: {
        summary,
        trends: trendsRes.rows.map(r => ({
          month: r.month || 'Unknown',
          avgScore: parseFloat(r.avgScore || 0),
          count: parseInt(r.count || 0)
        })),
        byProjectType: typeRes.rows.map(r => ({
          projectType: r.projectType,
          avgScore: parseFloat(r.avgScore || 0),
          count: parseInt(r.count || 0)
        })),
        byCity: cityRes.rows.map(r => ({
          city: r.city,
          avgScore: parseFloat(r.avgScore || 0),
          count: parseInt(r.count || 0)
        })),
        byTeamMember: teamRes.rows.map(r => ({
          userId: r.userId,
          name: r.name,
          roleName: r.roleName,
          avgScore: parseFloat(r.avgScore || 0),
          count: parseInt(r.count || 0)
        })),
        feedbacks: listRes.rows
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getVendorCapacityReport = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const query = `
      WITH active_projects AS (
        SELECT 
          pv.vendor_name,
          COUNT(DISTINCT p.id) as active_project_count
        FROM project_vendors pv
        JOIN projects p ON pv.project_id = p.id
        WHERE p.tenant_id = $1 AND p.status = 'active' AND p.deleted_at IS NULL
        GROUP BY pv.vendor_name
      ),
      all_vendors AS (
        SELECT DISTINCT vendor_name FROM project_vendors WHERE tenant_id = $1
      )
      SELECT 
        av.vendor_name,
        COALESCE(vcp.estimated_team_strength, 0) as estimated_team_strength,
        COALESCE(vcp.max_concurrent_projects, 5) as max_concurrent_projects,
        COALESCE(vcp.status, 'active') as status,
        COALESCE(ap.active_project_count, 0) as active_project_count
      FROM all_vendors av
      LEFT JOIN vendor_capacity_profiles vcp ON av.vendor_name = vcp.vendor_name AND vcp.tenant_id = $1
      LEFT JOIN active_projects ap ON av.vendor_name = ap.vendor_name
      ORDER BY av.vendor_name ASC
    `;

    const { rows } = await pool.query(query, [tenantId]);

    const data = rows.map(row => {
      const maxProj = parseInt(row.max_concurrent_projects, 10);
      const activeProj = parseInt(row.active_project_count, 10);
      const utilizationPercent = maxProj > 0 ? (activeProj / maxProj) * 100 : 100;
      let availabilityStatus = 'Available';
      if (utilizationPercent >= 100) availabilityStatus = 'Overloaded';
      else if (utilizationPercent >= 80) availabilityStatus = 'At Capacity';

      return {
        vendorName: row.vendor_name,
        estimatedTeamStrength: parseInt(row.estimated_team_strength, 10),
        maxConcurrentProjects: maxProj,
        activeProjectCount: activeProj,
        status: row.status,
        utilizationPercent: parseFloat(utilizationPercent.toFixed(1)),
        availabilityStatus
      };
    });

    res.json({ success: true, data });
  } catch (error) {
    next(error);
  }
};

exports.updateVendorCapacityProfile = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const { vendorName } = req.params;
    const { estimatedTeamStrength, maxConcurrentProjects, status } = req.body;

    const query = `
      INSERT INTO vendor_capacity_profiles (tenant_id, vendor_name, estimated_team_strength, max_concurrent_projects, status, updated_at)
      VALUES ($1, $2, $3, $4, $5, CURRENT_TIMESTAMP)
      ON CONFLICT (tenant_id, vendor_name) DO UPDATE SET
        estimated_team_strength = EXCLUDED.estimated_team_strength,
        max_concurrent_projects = EXCLUDED.max_concurrent_projects,
        status = EXCLUDED.status,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;

    const { rows } = await pool.query(query, [
      tenantId, 
      vendorName, 
      estimatedTeamStrength || 0, 
      maxConcurrentProjects || 5, 
      status || 'active'
    ]);

    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
};

exports.getTimelineAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const projQuery = await pool.query(`
      SELECT 
        COUNT(id) as total_projects,
        COUNT(id) FILTER (WHERE status = 'in_progress') as active_projects,
        COUNT(id) FILTER (WHERE status = 'completed') as completed_projects,
        COUNT(id) FILTER (WHERE status = 'delayed' OR (target_completion_date < CURRENT_DATE AND status != 'completed')) as delayed_projects,
        AVG(EXTRACT(DAY FROM (COALESCE(actual_completion_date, CURRENT_DATE) - start_date))) as avg_actual_duration,
        AVG(EXTRACT(DAY FROM (target_completion_date - start_date))) as avg_planned_duration
      FROM projects
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `, [tenantId]);

    const taskQuery = await pool.query(`
      SELECT 
        COUNT(id) as total_tasks,
        COUNT(id) FILTER (WHERE status = 'completed') as completed_tasks,
        COUNT(id) FILTER (WHERE due_date < CURRENT_DATE AND status != 'completed') as overdue_tasks
      FROM tasks
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `, [tenantId]);

    const pRow = projQuery.rows[0] || {};
    const tRow = taskQuery.rows[0] || {};

    const plannedDuration = Math.round(parseFloat(pRow.avg_planned_duration) || 0);
    const actualDuration = Math.round(parseFloat(pRow.avg_actual_duration) || 0);
    const totalTasks = parseInt(tRow.total_tasks || 0, 10);
    const completedTasks = parseInt(tRow.completed_tasks || 0, 10);
    const daysDelayed = Math.max(0, actualDuration - plannedDuration);
    const scheduleVariance = plannedDuration > 0 ? parseFloat((((actualDuration - plannedDuration) / plannedDuration) * 100).toFixed(1)) : 0;
    const timelinePerformance = totalTasks > 0 ? Math.round((completedTasks / totalTasks) * 100) : 100;

    const kpis = {
      plannedDuration,
      actualDuration,
      daysCompleted: actualDuration,
      daysRemaining: Math.max(0, plannedDuration - actualDuration),
      daysDelayed,
      scheduleVariance,
      timelinePerformance,
      expectedCompletion: new Date().toISOString(),
      currentDelayPercent: scheduleVariance > 0 ? scheduleVariance : 0,
      criticalMilestones: 0,
      upcomingMilestones: 0,
      missedMilestones: parseInt(pRow.delayed_projects || 0, 10)
    };

    const ganttRes = await pool.query(`
      SELECT id, title as name, start_date as "plannedStart", due_date as "plannedEnd",
             completed_at as "actualEnd", status, priority = 'critical' as "isCritical"
      FROM tasks
      WHERE tenant_id = $1 AND deleted_at IS NULL
      ORDER BY created_at DESC LIMIT 20
    `, [tenantId]);

    res.json({
      success: true,
      data: {
        kpis,
        ganttData: ganttRes.rows,
        delayCategories: [],
        timelineCharts: { plannedVsActual: [], dailyProgress: [] },
        forecasting: {
          estimatedCompletion: new Date().toISOString(),
          scheduleRecoveryPercent: 0,
          completionProbability: timelinePerformance
        }
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getResourceUtilizationAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const userStats = await pool.query(`
      SELECT 
        COUNT(u.id) as total_users,
        COUNT(t.id) as total_assigned_tasks,
        COUNT(t.id) FILTER (WHERE t.status = 'completed') as completed_tasks
      FROM users u
      LEFT JOIN tasks t ON t.assignee_id = u.id AND t.tenant_id = u.tenant_id AND t.deleted_at IS NULL
      WHERE u.tenant_id = $1
    `, [tenantId]);

    const uRow = userStats.rows[0] || {};
    const totalUsers = parseInt(uRow.total_users || 0, 10);
    const assignedTasks = parseInt(uRow.total_assigned_tasks || 0, 10);
    const resourceAllocation = totalUsers > 0 ? Math.min(100, Math.round((assignedTasks / (totalUsers * 5)) * 100)) : 0;

    const kpis = {
      utilizationPercent: resourceAllocation,
      availableCapacity: totalUsers * 40,
      idleTime: 0,
      workingHours: totalUsers * 40,
      overtime: 0,
      resourceAllocation,
      teamWorkload: resourceAllocation,
      employeeCapacity: 40,
      departmentUtilization: 0,
      resourceCost: 0,
      resourceEfficiency: 100
    };

    const teamRes = await pool.query(`
      SELECT u.id, u.name, COUNT(t.id) as total_tasks,
             COUNT(t.id) FILTER (WHERE t.status = 'completed') as completed_tasks
      FROM users u
      LEFT JOIN tasks t ON t.assignee_id = u.id AND t.tenant_id = u.tenant_id AND t.deleted_at IS NULL
      WHERE u.tenant_id = $1
      GROUP BY u.id, u.name
      ORDER BY total_tasks DESC LIMIT 15
    `, [tenantId]);

    const drillDownRecords = teamRes.rows.map(r => ({
      id: r.id,
      employee: r.name,
      department: 'Operations',
      project: '-',
      hoursLogged: parseInt(r.total_tasks || 0, 10) * 4,
      capacity: 40,
      utilization: parseInt(r.total_tasks || 0, 10) > 0 ? Math.min(100, parseInt(r.total_tasks, 10) * 10) : 0,
      status: parseInt(r.total_tasks || 0, 10) > 5 ? 'High' : 'Optimal'
    }));

    res.json({
      success: true,
      data: {
        kpis,
        heatmapData: [],
        capacityGraph: [],
        allocationTimeline: [],
        deptUtilization: [],
        overtimeTrend: [],
        drillDownRecords
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getTeamPerformanceAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const taskStats = await pool.query(`
      SELECT 
        COUNT(id) as total_tasks,
        COUNT(id) FILTER (WHERE status = 'completed') as tasks_completed,
        COUNT(id) FILTER (WHERE status = 'pending' OR status = 'todo') as tasks_pending,
        COUNT(id) FILTER (WHERE due_date < CURRENT_DATE AND status != 'completed') as tasks_overdue
      FROM tasks
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `, [tenantId]);

    const tRow = taskStats.rows[0] || {};
    const total = parseInt(tRow.total_tasks || 0, 10);
    const completed = parseInt(tRow.tasks_completed || 0, 10);
    const pending = parseInt(tRow.tasks_pending || 0, 10);
    const overdue = parseInt(tRow.tasks_overdue || 0, 10);
    const productivityScore = total > 0 ? Math.round((completed / total) * 100) : 100;

    const kpis = {
      tasksCompleted: completed,
      tasksPending: pending,
      tasksOverdue: overdue,
      avgCompletionTime: 0,
      productivityScore,
      qualityScore: 100,
      attendanceImpact: 100,
      siteVisits: 0,
      clientRatings: 0,
      reworkPercent: 0,
      efficiencyScore: productivityScore
    };

    const performers = await pool.query(`
      SELECT u.id, u.name, u.email,
             COUNT(t.id) FILTER (WHERE t.status = 'completed') as completed_count,
             COUNT(t.id) as total_count
      FROM users u
      LEFT JOIN tasks t ON t.assignee_id = u.id AND t.tenant_id = u.tenant_id AND t.deleted_at IS NULL
      WHERE u.tenant_id = $1
      GROUP BY u.id, u.name, u.email
      ORDER BY completed_count DESC LIMIT 10
    `, [tenantId]);

    const drillDownRecords = performers.rows.map(r => ({
      id: r.id,
      employee: r.name,
      department: 'Operations',
      tasks: parseInt(r.total_count || 0, 10),
      score: parseInt(r.total_count || 0, 10) > 0 ? Math.round((parseInt(r.completed_count || 0, 10) / parseInt(r.total_count, 10)) * 100) : 100,
      rating: 5.0,
      status: parseInt(r.completed_count || 0, 10) > 0 ? 'Active' : 'Pending'
    }));

    const topPerformer = performers.rows[0];

    res.json({
      success: true,
      data: {
        kpis,
        leaderboards: {
          bestPerformer: topPerformer ? { name: topPerformer.name, role: 'Staff', score: 100, avatar: '👤' } : null,
          mostProductiveDesigner: null,
          bestProjectManager: null,
          highestClientRating: null
        },
        productivityTrend: [],
        teamComparison: [],
        performanceDistribution: [],
        drillDownRecords
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getTaskAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const { rows } = await pool.query(`
      SELECT 
        COUNT(id) as total_tasks,
        COUNT(id) FILTER (WHERE status = 'completed') as completed,
        COUNT(id) FILTER (WHERE status = 'pending' OR status = 'todo') as pending,
        COUNT(id) FILTER (WHERE status = 'in_progress') as in_progress,
        COUNT(id) FILTER (WHERE status = 'blocked') as blocked,
        COUNT(id) FILTER (WHERE due_date < CURRENT_DATE AND status != 'completed') as overdue
      FROM tasks
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `, [tenantId]);

    const r = rows[0] || {};
    const total = parseInt(r.total_tasks || 0, 10);
    const completed = parseInt(r.completed || 0, 10);
    const pending = parseInt(r.pending || 0, 10);
    const inProgress = parseInt(r.in_progress || 0, 10);
    const blocked = parseInt(r.blocked || 0, 10);
    const overdue = parseInt(r.overdue || 0, 10);

    const priorityRes = await pool.query(`
      SELECT COALESCE(priority, 'Medium') as name, COUNT(id) as value
      FROM tasks
      WHERE tenant_id = $1 AND deleted_at IS NULL
      GROUP BY priority
    `, [tenantId]);

    const kpis = {
      totalTasks: total,
      completed,
      pending,
      inProgress,
      blocked,
      overdue,
      completionPercent: total > 0 ? parseFloat(((completed / total) * 100).toFixed(1)) : 0,
      taskAging: 0
    };

    res.json({
      success: true,
      data: {
        kpis,
        priorityDistribution: priorityRes.rows.map(x => ({ name: x.name, value: parseInt(x.value, 10) })),
        categoryDistribution: [],
        dailyCompletion: [],
        weeklyTrend: [],
        burnDown: [],
        burnUp: []
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getBudgetAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const budgetQuery = await pool.query(`
      SELECT 
        COALESCE(SUM(budget_max), 0) as total_budget
      FROM projects
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `, [tenantId]);

    const expenseQuery = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_utilized
      FROM project_expenses
      WHERE tenant_id = $1
    `, [tenantId]);

    const totalBudget = parseFloat(budgetQuery.rows[0]?.total_budget || 0);
    const totalUtilized = parseFloat(expenseQuery.rows[0]?.total_utilized || 0);
    const remainingBudget = Math.max(0, totalBudget - totalUtilized);

    const kpis = {
      budgetAllocated: totalBudget,
      budgetUtilized: totalUtilized,
      remainingBudget,
      burnRate: 0,
      unexpectedExpenses: 0,
      dailySpending: 0,
      forecastBudget: totalBudget
    };

    res.json({
      success: true,
      data: {
        kpis,
        costBreakdown: [],
        budgetTrend: [],
        departmentComparison: [],
        phaseCost: []
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getCashFlowAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const inQuery = await pool.query(`
      SELECT 
        COALESCE(SUM(amount), 0) as total_invoiced,
        COALESCE(SUM(paid_amount), 0) as cash_in
      FROM invoices
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `, [tenantId]);

    const outQuery = await pool.query(`
      SELECT 
        COALESCE(SUM(total_amount), 0) as cash_out
      FROM purchase_orders
      WHERE tenant_id = $1
    `, [tenantId]);

    const invoiced = parseFloat(inQuery.rows[0]?.total_invoiced || 0);
    const cashIn = parseFloat(inQuery.rows[0]?.cash_in || 0);
    const cashOut = parseFloat(outQuery.rows[0]?.cash_out || 0);
    const pendingReceivables = Math.max(0, invoiced - cashIn);

    const kpis = {
      cashIn,
      cashOut,
      pendingReceivables,
      pendingPayables: 0,
      netCashPosition: cashIn - cashOut,
      cashForecast: cashIn,
      monthlyCashFlow: cashIn - cashOut,
      collectionRate: invoiced > 0 ? parseFloat(((cashIn / invoiced) * 100).toFixed(1)) : 0
    };

    res.json({
      success: true,
      data: {
        kpis,
        cashFlowTimeline: [],
        receivableAging: [],
        payableAging: [],
        cashProjection: []
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getProcurementAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const prQuery = await pool.query(`
      SELECT 
        COUNT(id) as total_pr
      FROM purchase_requests
      WHERE tenant_id = $1
    `, [tenantId]);

    const poQuery = await pool.query(`
      SELECT 
        COUNT(id) as total_po,
        COUNT(id) FILTER (WHERE status = 'approved' OR status = 'issued') as approved_orders,
        COUNT(id) FILTER (WHERE status = 'pending') as pending_orders,
        COALESCE(SUM(total_amount), 0) as total_spend
      FROM purchase_orders
      WHERE tenant_id = $1
    `, [tenantId]);

    const totalPr = parseInt(prQuery.rows[0]?.total_pr || 0, 10);
    const totalPo = parseInt(poQuery.rows[0]?.total_po || 0, 10);
    const approvedOrders = parseInt(poQuery.rows[0]?.approved_orders || 0, 10);
    const pendingOrders = parseInt(poQuery.rows[0]?.pending_orders || 0, 10);

    const kpis = {
      purchaseRequests: totalPr,
      purchaseOrders: totalPo,
      approvedOrders,
      pendingOrders,
      deliveryTime: 0,
      procurementCycle: 0,
      vendorFulfillment: totalPo > 0 ? Math.round((approvedOrders / totalPo) * 100) : 100,
      purchaseCostTrend: 0,
      emergencyPurchases: 0,
      savings: 0
    };

    res.json({
      success: true,
      data: {
        kpis,
        monthlyProcurement: [],
        vendorComparison: [],
        materialCostTrend: []
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getVendorAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const vendorsRes = await pool.query(`
      SELECT 
        pv.id, pv.vendor_name as vendor,
        COUNT(po.id) as orders,
        COALESCE(SUM(po.total_amount), 0) as total_amount
      FROM project_vendors pv
      LEFT JOIN purchase_orders po ON po.vendor_id = pv.id AND po.tenant_id = pv.tenant_id
      WHERE pv.tenant_id = $1
      GROUP BY pv.id, pv.vendor_name
      ORDER BY orders DESC LIMIT 10
    `, [tenantId]);

    const kpis = {
      vendorRating: 0,
      deliveryTime: 0,
      delayedDeliveries: 0,
      qualityRating: 0,
      costTrend: 0,
      repeatOrders: 0,
      reliabilityScore: 100,
      vendorSla: 100,
      paymentCycle: 0
    };

    res.json({
      success: true,
      data: {
        kpis,
        vendorRanking: vendorsRes.rows.map((v) => ({
          vendor: v.vendor,
          score: 100,
          orders: parseInt(v.orders || 0, 10)
        })),
        monthlyPerformance: [],
        lateDeliveries: [],
        drillDownData: vendorsRes.rows.map((v) => ({
          id: v.id,
          vendor: v.vendor,
          category: 'Vendor',
          rating: 5.0,
          sla: '100%',
          delay: '0 days',
          status: 'Active'
        }))
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getMaterialAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const delQuery = await pool.query(`
      SELECT 
        COUNT(id) as total_deliveries,
        COALESCE(SUM(CASE WHEN status = 'rejected' THEN 1 ELSE 0 END), 0) as returns
      FROM material_deliveries
      WHERE tenant_id = $1
    `, [tenantId]);

    const totalDeliveries = parseInt(delQuery.rows[0]?.total_deliveries || 0, 10);
    const returns = parseInt(delQuery.rows[0]?.returns || 0, 10);

    const kpis = {
      materialUsage: totalDeliveries,
      materialWaste: 0,
      returns,
      consumptionTrend: 0,
      materialAging: 0,
      inventoryTurnover: 0,
      shortagePrediction: 0
    };

    res.json({
      success: true,
      data: {
        kpis,
        consumptionTimeline: [],
        materialComparison: [],
        wasteAnalysis: [],
        roomWiseConsumption: [],
        siteWiseConsumption: []
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getInventoryAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    let currentStock = 0;
    try {
      const invRes = await pool.query(`SELECT COUNT(id) as count FROM inventory_items WHERE tenant_id = $1`, [tenantId]);
      currentStock = parseInt(invRes.rows[0]?.count || 0, 10);
    } catch {
      // Table may be empty or unmigrated in this environment
    }

    const kpis = {
      currentStock,
      reservedStock: 0,
      lowStock: 0,
      deadStock: 0,
      fastMovingItems: 0,
      slowMovingItems: 0,
      inventoryValue: 0,
      stockAging: 0,
      warehouseCount: 0,
      reorderSuggestions: 0
    };

    res.json({
      success: true,
      data: {
        kpis,
        stockTrend: [],
        warehouseDistribution: [],
        inventoryValueTrend: []
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getQualityAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const punchQuery = await pool.query(`
      SELECT 
        COUNT(id) as total_snags,
        COUNT(id) FILTER (WHERE status = 'closed' OR status = 'resolved') as resolved_snags
      FROM punch_lists
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `, [tenantId]);

    const totalSnags = parseInt(punchQuery.rows[0]?.total_snags || 0, 10);
    const resolvedSnags = parseInt(punchQuery.rows[0]?.resolved_snags || 0, 10);
    const closureRate = totalSnags > 0 ? Math.round((resolvedSnags / totalSnags) * 100) : 100;

    const kpis = {
      inspections: 0,
      passRate: closureRate,
      failureRate: 100 - closureRate,
      reworkItems: totalSnags - resolvedSnags,
      totalDefects: totalSnags,
      totalSnags,
      snagClosureRate: closureRate,
      qcPending: totalSnags - resolvedSnags,
      qualityScore: closureRate
    };

    res.json({
      success: true,
      data: {
        kpis,
        inspectionTrend: [],
        defectTrend: [],
        qualityDistribution: []
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getSiteProgressAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const visitQuery = await pool.query(`
      SELECT COUNT(id) as total_visits
      FROM site_visits
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `, [tenantId]);

    const dsrQuery = await pool.query(`
      SELECT COUNT(id) as total_reports
      FROM daily_site_reports
      WHERE tenant_id = $1
    `, [tenantId]);

    const totalVisits = parseInt(visitQuery.rows[0]?.total_visits || 0, 10);
    const totalReports = parseInt(dsrQuery.rows[0]?.total_reports || 0, 10);

    const kpis = {
      dailyProgress: 0,
      weeklyProgress: 0,
      overallCompletion: 0,
      progressForecast: 0,
      photoUpdates: 0,
      videoUpdates: 0,
      geoTaggedVisits: totalVisits,
      activeFloors: 0,
      activeTrades: 0
    };

    res.json({
      success: true,
      data: {
        kpis,
        progressTimeline: [],
        floorProgress: [],
        tradeComparison: []
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getDelayAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const delayQuery = await pool.query(`
      SELECT 
        COUNT(id) as overdue_count,
        COALESCE(SUM(CURRENT_DATE - due_date), 0) as total_delay_days
      FROM tasks
      WHERE tenant_id = $1 AND due_date < CURRENT_DATE AND status != 'completed' AND deleted_at IS NULL
    `, [tenantId]);

    const totalDelayDays = parseInt(delayQuery.rows[0]?.total_delay_days || 0, 10);

    const kpis = {
      totalDelayDays,
      recoveryRate: 0,
      vendorDelays: 0,
      materialDelays: 0,
      approvalDelays: 0,
      laborDelays: 0,
      weatherDelays: 0,
      clientDelays: 0
    };

    res.json({
      success: true,
      data: {
        kpis,
        delayTrend: [],
        delayDistribution: [],
        delayHeatmap: []
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getClientAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const clientQuery = await pool.query(`
      SELECT 
        COUNT(id) as total_clients
      FROM clients
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `, [tenantId]);

    const totalClients = parseInt(clientQuery.rows[0]?.total_clients || 0, 10);

    const kpis = {
      clientSatisfaction: 100,
      feedbackRating: 5.0,
      npsScore: 100,
      meetingFrequency: 0,
      complaints: 0,
      escalations: 0,
      pendingApprovals: 0,
      avgResponseTime: 0,
      communicationVolume: 0
    };

    res.json({
      success: true,
      data: {
        kpis,
        satisfactionTrend: [],
        clientComparison: [],
        communicationAnalytics: []
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getPaymentAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const invQuery = await pool.query(`
      SELECT 
        COUNT(id) as total_invoices,
        COALESCE(SUM(paid_amount), 0) as paid_amount,
        COALESCE(SUM(amount - paid_amount), 0) as pending_amount,
        COALESCE(SUM(CASE WHEN due_date < CURRENT_DATE AND (amount - paid_amount) > 0 THEN (amount - paid_amount) ELSE 0 END), 0) as overdue_amount,
        COALESCE(SUM(tax_amount), 0) as total_gst
      FROM invoices
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `, [tenantId]);

    const r = invQuery.rows[0] || {};
    const totalInvoices = parseInt(r.total_invoices || 0, 10);
    const paidAmount = parseFloat(r.paid_amount || 0);
    const pendingAmount = parseFloat(r.pending_amount || 0);
    const overdueAmount = parseFloat(r.overdue_amount || 0);
    const totalGst = parseFloat(r.total_gst || 0);
    const totalAmount = paidAmount + pendingAmount;
    const collectionRate = totalAmount > 0 ? parseFloat(((paidAmount / totalAmount) * 100).toFixed(1)) : 0;

    const kpis = {
      totalInvoices,
      paidAmount,
      pendingAmount,
      overdueAmount,
      collectionRate,
      advancePayments: 0,
      retentionAmount: 0,
      totalGST: totalGst,
      totalTDS: 0
    };

    res.json({
      success: true,
      data: {
        kpis,
        paymentTrend: [],
        invoiceStatus: [
          { status: 'Paid', value: paidAmount },
          { status: 'Pending', value: pendingAmount },
          { status: 'Overdue', value: overdueAmount }
        ],
        receivableAging: []
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getChangeOrderAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const coQuery = await pool.query(`
      SELECT 
        COUNT(id) FILTER (WHERE status = 'approved') as total_approved,
        COUNT(id) FILTER (WHERE status = 'pending') as total_pending,
        COUNT(id) FILTER (WHERE status = 'rejected') as total_rejected,
        COALESCE(SUM(CASE WHEN status = 'approved' THEN total_amount ELSE 0 END), 0) as revenue_impact
      FROM change_orders
      WHERE tenant_id = $1
    `, [tenantId]);

    const r = coQuery.rows[0] || {};
    const totalApproved = parseInt(r.total_approved || 0, 10);
    const totalPending = parseInt(r.total_pending || 0, 10);
    const totalRejected = parseInt(r.total_rejected || 0, 10);
    const revenueImpact = parseFloat(r.revenue_impact || 0);

    const kpis = {
      totalApproved,
      totalPending,
      totalRejected,
      revenueImpact,
      costImpact: 0,
      scheduleImpact: 0,
      avgApprovalTime: 0,
      netVariation: 0
    };

    res.json({
      success: true,
      data: {
        kpis,
        monthlyChanges: [],
        revenueImpactTrend: [],
        approvalTimeTrend: []
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getRiskAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    let totalRisks = 0;
    let openRisks = 0;
    let resolvedRisks = 0;

    try {
      const riskQuery = await pool.query(`
        SELECT 
          COUNT(id) as total_risks,
          COUNT(id) FILTER (WHERE status = 'open') as open_risks,
          COUNT(id) FILTER (WHERE status = 'resolved' OR status = 'mitigated') as resolved_risks
        FROM project_risks
        WHERE tenant_id = $1
      `, [tenantId]);
      totalRisks = parseInt(riskQuery.rows[0]?.total_risks || 0, 10);
      openRisks = parseInt(riskQuery.rows[0]?.open_risks || 0, 10);
      resolvedRisks = parseInt(riskQuery.rows[0]?.resolved_risks || 0, 10);
    } catch {
      // Table may be unmigrated in this environment
    }

    const kpis = {
      totalRisks,
      openRisks,
      resolvedRisks,
      highRiskProjects: 0,
      avgRiskScore: 0,
      mitigationRate: totalRisks > 0 ? Math.round((resolvedRisks / totalRisks) * 100) : 100,
      avgProbability: 0,
      avgImpact: 0
    };

    res.json({
      success: true,
      data: {
        kpis,
        riskHeatmap: [],
        riskTrend: [],
        riskDistribution: []
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getExecutiveAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const invQuery = await pool.query(`
      SELECT 
        COALESCE(SUM(paid_amount), 0) as total_collections,
        COALESCE(SUM(amount), 0) as total_revenue
      FROM invoices
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `, [tenantId]);

    const projQuery = await pool.query(`
      SELECT 
        COALESCE(SUM(budget_max), 0) as total_budget,
        COUNT(id) as total_projects,
        COUNT(id) FILTER (WHERE status = 'delayed' OR (target_completion_date < CURRENT_DATE AND status != 'completed')) as critical_projects
      FROM projects
      WHERE tenant_id = $1 AND deleted_at IS NULL
    `, [tenantId]);

    const totalCollections = parseFloat(invQuery.rows[0]?.total_collections || 0);
    const totalRevenue = parseFloat(invQuery.rows[0]?.total_revenue || 0);
    const totalBudget = parseFloat(projQuery.rows[0]?.total_budget || 0);
    const criticalProjects = parseInt(projQuery.rows[0]?.critical_projects || 0, 10);

    const kpis = {
      totalRevenue,
      profitMargin: 0,
      totalBudget,
      totalCollections,
      netCashFlow: totalCollections,
      criticalProjects,
      projectHealthScore: criticalProjects > 0 ? 70 : 100,
      upcomingDeliveries: 0,
      resourceUtilization: 100,
      teamProductivity: 100
    };

    res.json({
      success: true,
      data: {
        kpis,
        executiveSummary: [],
        projectHealthDistribution: [],
        revenueTrend: [],
        budgetTrend: []
      }
    });
  } catch (error) {
    next(error);
  }
};

exports.getAIForecastAnalytics = async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const projRes = await pool.query(`
      SELECT 
        COUNT(id) as active_projects,
        AVG(EXTRACT(DAY FROM (target_completion_date - CURRENT_DATE))) as avg_days_left
      FROM projects
      WHERE tenant_id = $1 AND status = 'in_progress' AND deleted_at IS NULL
    `, [tenantId]);

    const activeCount = parseInt(projRes.rows[0]?.active_projects || 0, 10);
    const daysLeft = Math.max(0, Math.round(parseFloat(projRes.rows[0]?.avg_days_left) || 0));
    const targetDate = new Date(Date.now() + daysLeft * 86400000).toISOString().split('T')[0];

    const kpis = {
      completionDate: activeCount > 0 ? targetDate : new Date().toISOString().split('T')[0],
      completionConfidence: activeCount > 0 ? 85 : 100,
      budgetOverrun: 0,
      budgetConfidence: 100,
      profitMargin: 0,
      profitConfidence: 100,
      cashRequirement: 0,
      cashConfidence: 100,
      materialShortage: 0,
      materialConfidence: 100,
      vendorDelay: 0,
      vendorConfidence: 100,
      projectDelay: 0,
      delayConfidence: 100,
      riskScore: 0,
      riskConfidence: 100,
      completionProbability: 100
    };

    res.json({
      success: true,
      data: {
        kpis,
        cashForecast: [],
        delayProbability: [],
        profitMarginTrend: []
      }
    });
  } catch (error) {
    next(error);
  }
};
