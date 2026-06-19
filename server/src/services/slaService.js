const pool = require('../db/pool');

async function checkSLAsAndOverdueTasks() {
  console.log('Running SLA & Overdue Task checks...');
  const tenantQuery = `SELECT id FROM tenants`;
  const tenantsResult = await pool.query(tenantQuery);
  
  for (const tenant of tenantsResult.rows) {
    const tenantId = tenant.id;

    // Check SLA Breaches
    const slaQuery = `
      SELECT l.id, l.assignee_id, s.name as stage_name, s.max_days_in_stage,
             EXTRACT(DAY FROM CURRENT_TIMESTAMP - COALESCE(l.stage_updated_at, l.updated_at)) as days_in_stage
      FROM leads l
      JOIN lead_stages s ON l.stage_id = s.id
      WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
        AND EXTRACT(DAY FROM CURRENT_TIMESTAMP - COALESCE(l.stage_updated_at, l.updated_at)) > s.max_days_in_stage
    `;
    const breaches = await pool.query(slaQuery, [tenantId]);
    
    for (const breach of breaches.rows) {
      // You can add logic here to create notifications or log system activities
      console.log(`[Tenant: ${tenantId}] SLA Breached for Lead ${breach.id}: ${breach.days_in_stage} days in '${breach.stage_name}' (Limit: ${breach.max_days_in_stage})`);
      
      // Log an activity if not already logged recently (pseudo-logic, avoiding spam)
      // For now, we'll just log it to the console.
    }

    // Check Overdue Follow-ups
    const overdueQuery = `
      SELECT f.id, f.lead_id, f.title, EXTRACT(DAY FROM CURRENT_TIMESTAMP - f.due_at) as overdue_days
      FROM lead_followups f
      WHERE f.tenant_id = $1 AND f.is_done = FALSE AND f.due_at < CURRENT_TIMESTAMP
    `;
    const overdues = await pool.query(overdueQuery, [tenantId]);
    
    for (const overdue of overdues.rows) {
      console.log(`[Tenant: ${tenantId}] Overdue Follow-up for Lead ${overdue.lead_id}: Task '${overdue.title}' is overdue by ${overdue.overdue_days} days`);
    }
  }
}

module.exports = {
  checkSLAsAndOverdueTasks
};
