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
  const tasksRes = await readPool.query(`SELECT COUNT(*) as active_tasks FROM tasks WHERE tenant_id=$1 AND assignee_id=$2 AND status != 'done'`, [tenantId, userId]);
  const projectsRes = await readPool.query(`SELECT COUNT(*) as active_projects FROM projects WHERE tenant_id=$1 AND status = 'active'`, [tenantId]);
  return { tasks: tasksRes.rows[0], projects: projectsRes.rows[0] };
};

exports.getMarketingDashboard = async (tenantId) => {
  const sourcesRes = await readPool.query(`SELECT source, COUNT(*) as count, AVG(score) as avg_score FROM leads WHERE tenant_id=$1 GROUP BY source ORDER BY count DESC`, [tenantId]);
  return { sources: sourcesRes.rows };
};

exports.getOperationsDashboard = async (tenantId) => {
  const projectsRes = await readPool.query(`SELECT status, COUNT(*) as count FROM projects WHERE tenant_id=$1 GROUP BY status`, [tenantId]);
  const overdueTasksRes = await readPool.query(`SELECT COUNT(*) as overdue_tasks FROM tasks WHERE tenant_id=$1 AND due_date < CURRENT_DATE AND status != 'done'`, [tenantId]);
  return { projects: projectsRes.rows, overdueTasks: overdueTasksRes.rows[0] };
};
