const pool = require('../../config/db');

/**
 * Calculates coordination alert type and divergence days.
 */
function calculateCoordinationStatus(siteReadinessDate, factoryReadinessDate) {
  if (!siteReadinessDate || !factoryReadinessDate) {
    return { alertType: 'pending_setup', divergenceDays: 0 };
  }

  const siteTime = new Date(siteReadinessDate).setHours(0, 0, 0, 0);
  const factoryTime = new Date(factoryReadinessDate).setHours(0, 0, 0, 0);

  const diffMs = factoryTime - siteTime;
  const divergenceDays = Math.round(diffMs / (1000 * 60 * 60 * 24));

  if (divergenceDays > 3) {
    return { alertType: 'factory_delay', divergenceDays };
  } else if (divergenceDays < -3) {
    return { alertType: 'site_delay', divergenceDays: Math.abs(divergenceDays) };
  } else {
    return { alertType: 'aligned', divergenceDays };
  }
}

/**
 * Automatically evaluates and triggers a draft delay notification if factory date exceeds site readiness date.
 */
async function checkAndTriggerCoordinationDelays(tenantId, projectId, client = pool) {
  // Fetch project site readiness date as TEXT
  const projRes = await client.query(
    'SELECT name, site_readiness_date::TEXT as site_readiness_date FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
    [projectId, tenantId]
  );
  if (projRes.rows.length === 0) return;
  const project = projRes.rows[0];
  if (!project.site_readiness_date) return;

  // Fetch maximum expected completion date of active production orders as TEXT
  const prodRes = await client.query(
    `SELECT MAX(expected_completion_date)::DATE::TEXT as max_completion_date
     FROM production_orders
     WHERE project_id = $1 AND tenant_id = $2 AND status != 'cancelled'`,
    [projectId, tenantId]
  );
  const factoryCompletion = prodRes.rows[0]?.max_completion_date;
  if (!factoryCompletion) return;

  const siteDateStr = project.site_readiness_date;
  const factoryDateStr = factoryCompletion;

  const status = calculateCoordinationStatus(project.site_readiness_date, factoryCompletion);

  if (status.alertType === 'factory_delay') {
    const reason = `Factory production completion date (${factoryDateStr}) is delayed by ${status.divergenceDays} days beyond the site readiness date (${siteDateStr}).`;
    
    // Check if an active draft delay notification for this mismatch already exists
    const checkNotif = await client.query(
      `SELECT id FROM delay_notifications
       WHERE project_id = $1 AND tenant_id = $2 AND type = 'project_delay' AND status = 'draft' AND reason LIKE 'Factory production%' LIMIT 1`,
      [projectId, tenantId]
    );

    if (checkNotif.rows.length === 0) {
      const messageDraft = `Dear Client, we would like to inform you that modular items dispatch for your project "${project.name}" is scheduled for completion at the factory on ${factoryDateStr}. Since site readiness was planned for ${siteDateStr}, this may adjust our installation sequence. We are working to minimize any impacts.`;
      
      await client.query(
        `INSERT INTO delay_notifications (
          tenant_id, project_id, type, original_date, revised_date, reason, message_draft, status
         ) VALUES ($1, $2, 'project_delay', $3, $4, $5, $6, 'draft')`,
        [tenantId, projectId, project.site_readiness_date, factoryCompletion, reason, messageDraft]
      );
    }
  }
}

/**
 * Gets coordination details for a single project.
 */
async function getProjectCoordination(tenantId, projectId) {
  const projRes = await pool.query(
    `SELECT p.id, p.name, p.site_readiness_date::TEXT as site_readiness_date, p.target_date::TEXT as target_date, p.status,
            u.name as pm_name
     FROM projects p
     LEFT JOIN users u ON p.pm_id = u.id
     WHERE p.id = $1 AND p.tenant_id = $2 AND p.deleted_at IS NULL`,
    [projectId, tenantId]
  );

  if (projRes.rows.length === 0) throw new Error('NOT_FOUND');
  const project = projRes.rows[0];

  // Fetch production orders with date cast to TEXT
  const ordersRes = await pool.query(
    `SELECT po.id, po.order_number, po.status, po.factory_name, po.expected_completion_date::DATE::TEXT as expected_completion_date,
            (SELECT COUNT(*)::int FROM production_order_items WHERE production_order_id = po.id) as item_count
     FROM production_orders po
     WHERE po.project_id = $1 AND po.tenant_id = $2 AND po.status != 'cancelled'
     ORDER BY po.created_at DESC`,
    [projectId, tenantId]
  );

  // Find max completion date
  let maxCompletionDate = null;
  ordersRes.rows.forEach(order => {
    if (order.expected_completion_date) {
      if (!maxCompletionDate || order.expected_completion_date > maxCompletionDate) {
        maxCompletionDate = order.expected_completion_date;
      }
    }
  });

  const coordStatus = calculateCoordinationStatus(project.site_readiness_date, maxCompletionDate);

  return {
    projectId: project.id,
    projectName: project.name,
    projectStatus: project.status,
    pmName: project.pm_name || 'Unassigned',
    siteReadinessDate: project.site_readiness_date,
    targetDate: project.target_date,
    factoryReadinessDate: maxCompletionDate,
    alertType: coordStatus.alertType,
    divergenceDays: coordStatus.divergenceDays,
    productionOrders: ordersRes.rows
  };
}

/**
 * Gets coordination dashboard data for all active projects.
 */
async function getCoordinationDashboard(tenantId) {
  const projectsRes = await pool.query(
    `SELECT p.id, p.name, p.site_readiness_date::TEXT as site_readiness_date, p.target_date::TEXT as target_date,
            u.name as pm_name,
            (
              SELECT MAX(expected_completion_date)::DATE::TEXT
              FROM production_orders
              WHERE project_id = p.id AND tenant_id = $1 AND status != 'cancelled'
            ) as factory_readiness_date,
            (
              SELECT COUNT(*)::int
              FROM production_orders
              WHERE project_id = p.id AND tenant_id = $1 AND status != 'cancelled'
            ) as active_orders_count
     FROM projects p
     LEFT JOIN users u ON p.pm_id = u.id
     WHERE p.tenant_id = $1 AND p.deleted_at IS NULL AND p.status IN ('active', 'pending_booking')
     ORDER BY p.name ASC`,
    [tenantId]
  );

  const dashboardItems = projectsRes.rows.map(proj => {
    const coord = calculateCoordinationStatus(proj.site_readiness_date, proj.factory_readiness_date);
    return {
      projectId: proj.id,
      projectName: proj.name,
      pmName: proj.pm_name || 'Unassigned',
      siteReadinessDate: proj.site_readiness_date,
      targetDate: proj.target_date,
      factoryReadinessDate: proj.factory_readiness_date,
      activeOrdersCount: proj.active_orders_count || 0,
      alertType: coord.alertType,
      divergenceDays: coord.divergenceDays
    };
  });

  // Sort dashboard items: prioritises alerts (factory_delay / site_delay) over aligned and pending
  const alertPriority = {
    factory_delay: 1,
    site_delay: 2,
    aligned: 3,
    pending_setup: 4
  };

  return dashboardItems.sort((a, b) => {
    return alertPriority[a.alertType] - alertPriority[b.alertType];
  });
}

module.exports = {
  calculateCoordinationStatus,
  checkAndTriggerCoordinationDelays,
  getProjectCoordination,
  getCoordinationDashboard
};
