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
    const ratingQuery = `
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

    // Fetch all active projects
    const projectsQuery = `
      SELECT id, name, client_name 
      FROM projects 
      WHERE tenant_id = $1 AND status = 'active'
      ORDER BY name ASC
    `;
    const projectsRes = await pool.query(projectsQuery, [tenantId]);

    // Fetch all payment milestones for active projects
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
      WHERE p.tenant_id = $1 AND p.status = 'active'
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
          month: r.month,
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
