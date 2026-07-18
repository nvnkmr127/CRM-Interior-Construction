const pool = require('../db/pool');
const delayNotificationService = require('../services/projects/delayNotificationService');

async function runDelayEscalation() {
  console.log('[delayEscalationJob] Starting delay escalation check...');
  const client = await pool.connect();
  try {
    // 1. Fetch all active projects
    const projectsRes = await client.query(`
      SELECT id, tenant_id FROM projects
      WHERE status = 'active'
    `);
    
    const projects = projectsRes.rows;
    console.log(`[delayEscalationJob] Found ${projects.length} active projects to check.`);

    // 2. Detect and create drafts for each project (which also notifies PM)
    for (const project of projects) {
      try {
        await delayNotificationService.detectAndCreateDelayDrafts(project.tenant_id, project.id);
      } catch (err) {
        console.error(`[delayEscalationJob] Failed to detect delays for project ${project.id}:`, err.message);
      }
    }

    // 3. Check and escalate unaddressed drafts across all tenants
    // We can group by tenant to optimize
    const tenantsRes = await client.query(`SELECT id FROM tenants`);
    const tenants = tenantsRes.rows;

    for (const tenant of tenants) {
      try {
        await delayNotificationService.checkAndEscalateDelays(tenant.id);
      } catch (err) {
        console.error(`[delayEscalationJob] Failed to check escalations for tenant ${tenant.id}:`, err.message);
      }
    }

    console.log('[delayEscalationJob] Completed delay escalation check.');
  } catch (error) {
    console.error('[delayEscalationJob] Error running delay escalation:', error);
  } finally {
    client.release();
  }
}

module.exports = {
  run: runDelayEscalation
};
