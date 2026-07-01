const db = require('../../config/db');
const readPool = db.readPool || db;

exports.getGlobalStats = async (tenantId, userId) => {
  const activeLeadsRes = await readPool.query(`SELECT COUNT(*) FROM leads WHERE tenant_id=$1 AND status='active' AND deleted_at IS NULL`, [tenantId]);
  const wonThisMonthRes = await readPool.query(`
    SELECT COUNT(*), 0 as won_value
    FROM leads l
    JOIN lead_stages ls ON ls.id = l.stage_id
    WHERE l.tenant_id=$1 AND ls.is_won=true
    AND l.updated_at >= date_trunc('month', NOW())
  `, [tenantId]);
  const projectsRes = await readPool.query(`
    SELECT
      COUNT(*) FILTER (WHERE status='active') as active,
      COUNT(*) FILTER (WHERE status='active' AND target_date < NOW()) as overdue
    FROM projects WHERE tenant_id=$1 AND deleted_at IS NULL
  `, [tenantId]);
  const tasksRes = await readPool.query(`
    SELECT
      COUNT(*) FILTER (WHERE due_date=CURRENT_DATE) as due_today,
      COUNT(*) FILTER (WHERE due_date < CURRENT_DATE AND status!='done') as overdue
    FROM tasks
    WHERE tenant_id=$1 AND assignee_id=$2 AND deleted_at IS NULL AND status!='done'
  `, [tenantId, userId]);
  const prevWeekLeadsRes = await readPool.query(`
    SELECT COUNT(*) FROM leads
    WHERE tenant_id=$1 AND status='active' AND deleted_at IS NULL
    AND created_at >= NOW() - INTERVAL '14 days'
    AND created_at < NOW() - INTERVAL '7 days'
  `, [tenantId]);
  const targetsRes = await readPool.query(`SELECT 0 as target_revenue, 0 as target_leads`);

  const activeCount = parseInt(activeLeadsRes.rows[0].count, 10);
  const prevWeekCount = parseInt(prevWeekLeadsRes.rows[0].count, 10);
  const trendDiff = activeCount - prevWeekCount;
  const trend = trendDiff > 0 ? `+${trendDiff}` : `${trendDiff}`;
  
  const targets = targetsRes && targetsRes.rows.length > 0 ? targetsRes.rows[0] : { target_revenue: 0, target_leads: 0 };

  return {
    activeLeads: {
      count: activeCount,
      prevWeekCount,
      trend
    },
    wonThisMonth: {
      count: parseInt(wonThisMonthRes.rows[0].count, 10),
      value: parseFloat(wonThisMonthRes.rows[0].won_value)
    },
    activeProjects: {
      count: parseInt(projectsRes.rows[0].active, 10) || 0,
      overdueCount: parseInt(projectsRes.rows[0].overdue, 10) || 0
    },
    tasksDueToday: {
      count: parseInt(tasksRes.rows[0].due_today, 10) || 0,
      overdueCount: parseInt(tasksRes.rows[0].overdue, 10) || 0
    },
    salesTargets: {
      targetRevenue: parseFloat(targets.target_revenue) || 0,
      targetLeads: parseInt(targets.target_leads, 10) || 0
    }
  };
};

exports.getSalesDashboard = async (tenantId, userId) => {
  const pipelineRes = await readPool.query(`
      SELECT ls.name, COUNT(l.id) as count
      FROM lead_stages ls
      LEFT JOIN leads l ON l.stage_id=ls.id AND l.assignee_id=$2 AND l.deleted_at IS NULL AND l.tenant_id=$1
      WHERE ls.tenant_id=$1 GROUP BY ls.id ORDER BY ls.sort_order
    `, [tenantId, userId]);
  const tasksRes = await readPool.query(`
      SELECT id, title, status, priority, due_date
      FROM tasks WHERE tenant_id=$1 AND assignee_id=$2 AND status != 'done' AND deleted_at IS NULL
      ORDER BY due_date ASC LIMIT 10
    `, [tenantId, userId]);
  const performanceRes = await readPool.query(`
      SELECT COUNT(*) as won_count, 0 as revenue
      FROM leads l
      JOIN lead_stages ls ON ls.id = l.stage_id
      WHERE l.tenant_id=$1 AND l.assignee_id=$2 AND ls.is_won=true
      AND l.updated_at >= date_trunc('month', NOW())
    `, [tenantId, userId]);
  
  return {
    pipeline: pipelineRes.rows,
    upcomingTasks: tasksRes.rows,
    monthlyPerformance: performanceRes.rows[0]
  };
};

exports.getManagerDashboard = async (tenantId) => {
  const teamPerformanceRes = await readPool.query(`
      SELECT u.name as rep_name, COUNT(l.id) as active_leads, 0 as potential_revenue
      FROM users u
      LEFT JOIN leads l ON l.assignee_id = u.id AND l.status = 'active' AND l.tenant_id=$1
      WHERE u.tenant_id=$1 AND u.role = 'sales_executive'
      GROUP BY u.name
    `, [tenantId]);
  const activePipelineRes = await readPool.query(`
      SELECT ls.name as stage, COUNT(l.id) as count, 0 as total_value
      FROM lead_stages ls
      LEFT JOIN leads l ON l.stage_id = ls.id AND l.deleted_at IS NULL AND l.tenant_id=$1
      WHERE ls.tenant_id=$1 GROUP BY ls.id ORDER BY ls.sort_order
    `, [tenantId]);
  const slaBreachesRes = await readPool.query(`
      SELECT l.id, l.name, l.created_at, u.name as rep_name
      FROM leads l
      JOIN users u ON u.id = l.assignee_id
      WHERE l.tenant_id=$1 AND l.status = 'active' AND l.created_at < NOW() - INTERVAL '48 hours' AND l.stage_id = (SELECT id FROM lead_stages WHERE tenant_id=$1 ORDER BY sort_order ASC LIMIT 1)
      LIMIT 10
    `, [tenantId]);
  
  return {
    teamPerformance: teamPerformanceRes.rows,
    activePipeline: activePipelineRes.rows,
    slaBreaches: slaBreachesRes.rows
  };
};

exports.getCeoDashboard = async (tenantId) => {
  const revenueRes = await readPool.query(`SELECT 0 as total_pipeline, COUNT(id) as total_leads FROM leads WHERE tenant_id=$1 AND status NOT IN ('won', 'lost', 'archived')`, [tenantId]);
  const pipelineRes = await readPool.query(`SELECT status, COUNT(*) as count FROM leads WHERE tenant_id=$1 GROUP BY status`, [tenantId]);
  return { revenue: revenueRes.rows[0], pipelineDistribution: pipelineRes.rows };
};

exports.getDesignerDashboard = async (tenantId, userId) => {
  const projectsByStageRes = await readPool.query(`
    SELECT COALESCE(design_stage, 'Unassigned') as stage, COUNT(*) as count 
    FROM projects 
    WHERE tenant_id=$1 AND designer_id=$2 AND status='active' AND deleted_at IS NULL
    GROUP BY design_stage
  `, [tenantId, userId]);

  const pendingDocsRes = await readPool.query(`
    SELECT COUNT(*) as count
    FROM documents d
    JOIN projects p ON d.project_id = p.id
    WHERE d.tenant_id=$1 AND p.designer_id=$2 AND d.client_approval_status='pending' AND p.status='active' AND p.deleted_at IS NULL
  `, [tenantId, userId]);

  const pendingDesignAssetsRes = await readPool.query(`
    SELECT COUNT(*) as count
    FROM design_assets da
    JOIN projects p ON da.project_id = p.id
    WHERE da.tenant_id=$1 AND p.designer_id=$2 AND da.status='pending_approval' AND p.status='active' AND p.deleted_at IS NULL
  `, [tenantId, userId]);

  const overdueTasksRes = await readPool.query(`
    SELECT id, title, due_date, priority
    FROM tasks
    WHERE tenant_id=$1 AND assignee_id=$2 AND status != 'done' AND due_date < CURRENT_DATE AND deleted_at IS NULL
    ORDER BY due_date ASC
    LIMIT 10
  `, [tenantId, userId]);

  const upcomingDeadlinesRes = await readPool.query(`
    SELECT id, title, due_date, priority
    FROM tasks
    WHERE tenant_id=$1 AND assignee_id=$2 AND status != 'done' AND due_date >= CURRENT_DATE AND due_date <= CURRENT_DATE + INTERVAL '7 days' AND deleted_at IS NULL
    ORDER BY due_date ASC
    LIMIT 10
  `, [tenantId, userId]);

  return {
    projectsByStage: projectsByStageRes.rows,
    pendingApprovals: {
      documents: parseInt(pendingDocsRes.rows[0].count, 10) || 0,
      designAssets: parseInt(pendingDesignAssetsRes.rows[0].count, 10) || 0,
      total: (parseInt(pendingDocsRes.rows[0].count, 10) || 0) + (parseInt(pendingDesignAssetsRes.rows[0].count, 10) || 0)
    },
    overdueTasks: overdueTasksRes.rows,
    upcomingDeadlines: upcomingDeadlinesRes.rows
  };
};

exports.getMarketingDashboard = async (tenantId) => {
  const sourcesRes = await readPool.query(`SELECT source, COUNT(*) as count, AVG(score) as avg_score FROM leads WHERE tenant_id=$1 GROUP BY source ORDER BY count DESC`, [tenantId]);
  return { sources: sourcesRes.rows };
};

exports.getOperationsDashboard = async (tenantId) => {
  const activeProjectsByCityRes = await readPool.query(`
    SELECT COALESCE(city, 'Unknown') as city, COUNT(*) as count 
    FROM projects 
    WHERE tenant_id=$1 AND status = 'active' AND deleted_at IS NULL
    GROUP BY city
    ORDER BY count DESC
  `, [tenantId]);

  const ragStatusRes = await readPool.query(`
    SELECT 
      COUNT(*) FILTER (WHERE target_date < CURRENT_DATE) as critical_count,
      COUNT(*) FILTER (WHERE target_date >= CURRENT_DATE AND target_date <= CURRENT_DATE + INTERVAL '7 days') as at_risk_count,
      COUNT(*) FILTER (WHERE target_date > CURRENT_DATE + INTERVAL '7 days' OR target_date IS NULL) as on_track_count
    FROM projects
    WHERE tenant_id=$1 AND status = 'active' AND deleted_at IS NULL
  `, [tenantId]);

  const ragStats = ragStatusRes.rows[0];
  const overdueProjectsCount = parseInt(ragStats.critical_count, 10) || 0;

  const revenueRes = await readPool.query(`
    SELECT 
      SUM(pm.paid_amount) as collected,
      SUM(pm.amount - COALESCE(pm.paid_amount, 0)) as outstanding
    FROM payment_milestones pm
    JOIN projects p ON pm.project_id = p.id
    WHERE pm.tenant_id=$1 AND p.status = 'active' AND p.deleted_at IS NULL
  `, [tenantId]);

  const openSnagsRes = await readPool.query(`
    SELECT COUNT(*) as count
    FROM snags s
    JOIN projects p ON s.project_id = p.id
    WHERE s.tenant_id=$1 AND s.status NOT IN ('resolved', 'client_verified') AND p.status = 'active' AND p.deleted_at IS NULL
  `, [tenantId]);

  const serviceTicketsRes = await readPool.query(`
    SELECT priority, COUNT(*) as count
    FROM service_tickets
    WHERE tenant_id=$1 AND status NOT IN ('resolved', 'closed')
    GROUP BY priority
  `, [tenantId]);

  const weeklyTrendsRes = await readPool.query(`
    SELECT 
      TO_CHAR(DATE_TRUNC('week', created_at), 'YYYY-MM-DD') as week,
      COUNT(*) as new_projects
    FROM projects
    WHERE tenant_id=$1 AND created_at >= CURRENT_DATE - INTERVAL '6 weeks' AND deleted_at IS NULL
    GROUP BY DATE_TRUNC('week', created_at)
    ORDER BY DATE_TRUNC('week', created_at) ASC
  `, [tenantId]);

  return { 
    activeProjectsByCity: activeProjectsByCityRes.rows,
    ragStatusDistribution: {
      critical: parseInt(ragStats.critical_count, 10) || 0,
      atRisk: parseInt(ragStats.at_risk_count, 10) || 0,
      onTrack: parseInt(ragStats.on_track_count, 10) || 0
    },
    revenue: {
      collected: parseFloat(revenueRes.rows[0].collected) || 0,
      outstanding: parseFloat(revenueRes.rows[0].outstanding) || 0
    },
    overdueProjects: overdueProjectsCount,
    openSnags: parseInt(openSnagsRes.rows[0].count, 10) || 0,
    serviceTicketLoad: serviceTicketsRes.rows,
    weeklyTrends: weeklyTrendsRes.rows
  };
};

exports.getFinanceDashboard = async (tenantId) => {
  const contractValueRes = await readPool.query(`
    SELECT 
      SUM(contract_value) as total_value,
      SUM(contract_value) FILTER (WHERE created_at >= date_trunc('month', CURRENT_DATE)) as this_month_value
    FROM projects
    WHERE tenant_id=$1 AND status != 'cancelled' AND deleted_at IS NULL
  `, [tenantId]);

  const receivablesRes = await readPool.query(`
    SELECT 
      SUM(paid_amount) as total_collected,
      SUM(amount - COALESCE(paid_amount, 0)) as total_outstanding
    FROM payment_milestones
    WHERE tenant_id=$1
  `, [tenantId]);

  const agingBucketsRes = await readPool.query(`
    SELECT 
      SUM(amount - COALESCE(paid_amount, 0)) FILTER (WHERE CURRENT_DATE - due_date BETWEEN 1 AND 30) as days_1_30,
      SUM(amount - COALESCE(paid_amount, 0)) FILTER (WHERE CURRENT_DATE - due_date BETWEEN 31 AND 60) as days_31_60,
      SUM(amount - COALESCE(paid_amount, 0)) FILTER (WHERE CURRENT_DATE - due_date BETWEEN 61 AND 90) as days_61_90,
      SUM(amount - COALESCE(paid_amount, 0)) FILTER (WHERE CURRENT_DATE - due_date > 90) as days_90_plus
    FROM payment_milestones
    WHERE tenant_id=$1 AND due_date < CURRENT_DATE AND status != 'paid'
  `, [tenantId]);

  const upcomingMilestonesRes = await readPool.query(`
    SELECT pm.id, pm.name, pm.amount, pm.due_date, p.name as project_name
    FROM payment_milestones pm
    JOIN projects p ON pm.project_id = p.id
    WHERE pm.tenant_id=$1 AND pm.status != 'paid' AND pm.due_date BETWEEN CURRENT_DATE AND CURRENT_DATE + INTERVAL '30 days'
    ORDER BY pm.due_date ASC
    LIMIT 10
  `, [tenantId]);

  const vendorPayablesRes = await readPool.query(`
    SELECT SUM(amount - COALESCE(paid_amount, 0)) as outstanding
    FROM vendor_payment_milestones
    WHERE tenant_id=$1 AND status != 'paid'
  `, [tenantId]);

  const revenueTrendRes = await readPool.query(`
    SELECT 
      TO_CHAR(DATE_TRUNC('month', TO_DATE(paid_at, 'YYYY-MM-DD')), 'YYYY-MM') as month,
      SUM(paid_amount) as revenue
    FROM payment_milestones
    WHERE tenant_id=$1 AND paid_at IS NOT NULL AND TO_DATE(paid_at, 'YYYY-MM-DD') >= date_trunc('month', CURRENT_DATE - INTERVAL '5 months')
    GROUP BY DATE_TRUNC('month', TO_DATE(paid_at, 'YYYY-MM-DD'))
    ORDER BY month ASC
  `, [tenantId]);

  return {
    contractValue: {
      total: parseFloat(contractValueRes.rows[0].total_value) || 0,
      thisMonth: parseFloat(contractValueRes.rows[0].this_month_value) || 0
    },
    receivables: {
      collected: parseFloat(receivablesRes.rows[0].total_collected) || 0,
      outstanding: parseFloat(receivablesRes.rows[0].total_outstanding) || 0
    },
    agingBuckets: {
      days_1_30: parseFloat(agingBucketsRes.rows[0].days_1_30) || 0,
      days_31_60: parseFloat(agingBucketsRes.rows[0].days_31_60) || 0,
      days_61_90: parseFloat(agingBucketsRes.rows[0].days_61_90) || 0,
      days_90_plus: parseFloat(agingBucketsRes.rows[0].days_90_plus) || 0
    },
    upcomingMilestones: upcomingMilestonesRes.rows,
    vendorPayablesOutstanding: parseFloat(vendorPayablesRes.rows[0].outstanding) || 0,
    monthlyRevenueTrend: revenueTrendRes.rows
  };
};

exports.getFieldOperationsDashboard = async (tenantId, userId) => {
  const activeSitesRes = await readPool.query(`
    SELECT id, name, site_address, target_date
    FROM projects
    WHERE tenant_id=$1 AND status = 'active' AND (site_engineer_id = $2 OR qc_engineer_id = $2) AND deleted_at IS NULL
  `, [tenantId, userId]);

  const todaysVisitsRes = await readPool.query(`
    SELECT sv.id, sv.scheduled_at, sv.status, p.name as project_name
    FROM site_visits sv
    JOIN projects p ON sv.project_id = p.id
    WHERE sv.tenant_id=$1 AND sv.assignee_id=$2 AND DATE(sv.scheduled_at) = CURRENT_DATE
    ORDER BY sv.scheduled_at ASC
  `, [tenantId, userId]);

  const pendingQCRes = await readPool.query(`
    SELECT qs.id, qs.stage_name, p.name as project_name
    FROM project_qc_stages qs
    JOIN projects p ON qs.project_id = p.id
    WHERE qs.tenant_id=$1 AND qs.qc_engineer_id=$2 AND qs.status = 'pending'
  `, [tenantId, userId]);

  const openSnagsRes = await readPool.query(`
    SELECT p.name as project_name, COUNT(s.id) as count
    FROM snags s
    JOIN projects p ON s.project_id = p.id
    WHERE s.tenant_id=$1 AND (p.site_engineer_id = $2 OR p.qc_engineer_id = $2) 
      AND s.status NOT IN ('resolved', 'client_verified') AND p.status = 'active' AND p.deleted_at IS NULL
    GROUP BY p.name
    ORDER BY count DESC
  `, [tenantId, userId]);

  const overdueSnagsRes = await readPool.query(`
    SELECT s.id, s.title, s.created_at, p.name as project_name
    FROM snags s
    JOIN projects p ON s.project_id = p.id
    WHERE s.tenant_id=$1 AND (p.site_engineer_id = $2 OR p.qc_engineer_id = $2)
      AND s.status NOT IN ('resolved', 'client_verified') 
      AND s.created_at + (s.sla_hours * interval '1 hour') < NOW()
      AND p.status = 'active' AND p.deleted_at IS NULL
  `, [tenantId, userId]);

  return {
    activeSites: activeSitesRes.rows,
    todaysVisits: todaysVisitsRes.rows,
    pendingQC: pendingQCRes.rows,
    openSnagsByProject: openSnagsRes.rows,
    overdueSnags: overdueSnagsRes.rows
  };
};

exports.getProcurementDashboard = async (tenantId) => {
  const pendingPRsRes = await readPool.query(`
    SELECT pr.id, pr.pr_number, pr.required_by_date, p.name as project_name
    FROM purchase_requests pr
    JOIN projects p ON pr.project_id = p.id
    WHERE pr.tenant_id=$1 AND pr.status = 'pending_approval'
    ORDER BY pr.required_by_date ASC
  `, [tenantId]);

  const activePOsRes = await readPool.query(`
    SELECT status, COUNT(*) as count, SUM(total_amount) as total_value
    FROM purchase_orders
    WHERE tenant_id=$1 AND status IN ('sent', 'confirmed', 'partially received')
    GROUP BY status
  `, [tenantId]);

  const materialsInTransitRes = await readPool.query(`
    SELECT md.id, md.delivery_number, md.expected_delivery_date, po.po_number, p.name as project_name
    FROM material_deliveries md
    JOIN purchase_orders po ON md.purchase_order_id = po.id
    JOIN projects p ON md.project_id = p.id
    WHERE md.tenant_id=$1 AND md.status = 'pending'
    ORDER BY md.expected_delivery_date ASC
  `, [tenantId]);

  const criticalShortagesRes = await readPool.query(`
    SELECT pr.id, pr.pr_number, pr.required_by_date, p.name as project_name
    FROM purchase_requests pr
    JOIN projects p ON pr.project_id = p.id
    WHERE pr.tenant_id=$1 AND pr.status = 'approved' AND pr.required_by_date <= CURRENT_DATE + INTERVAL '7 days'
    ORDER BY pr.required_by_date ASC
  `, [tenantId]);

  const vendorPerformanceRes = await readPool.query(`
    SELECT 
      v.name as vendor_name,
      COUNT(md.id) as total_deliveries,
      COUNT(md.id) FILTER (WHERE md.actual_receipt_date <= md.expected_delivery_date) as on_time_deliveries
    FROM material_deliveries md
    JOIN purchase_orders po ON md.purchase_order_id = po.id
    JOIN project_vendors v ON po.vendor_id = v.id
    WHERE md.tenant_id=$1 AND md.status IN ('delivered', 'inspected', 'partially received')
    GROUP BY v.name
    ORDER BY total_deliveries DESC
  `, [tenantId]);

  return {
    pendingPRs: pendingPRsRes.rows,
    activePOs: activePOsRes.rows,
    materialsInTransit: materialsInTransitRes.rows,
    criticalShortages: criticalShortagesRes.rows,
    vendorPerformance: vendorPerformanceRes.rows.map(v => ({
      vendor_name: v.vendor_name,
      total_deliveries: parseInt(v.total_deliveries, 10),
      on_time_deliveries: parseInt(v.on_time_deliveries, 10),
      on_time_rate: v.total_deliveries > 0 ? (parseInt(v.on_time_deliveries, 10) / parseInt(v.total_deliveries, 10)) * 100 : 0
    }))
  };
};
