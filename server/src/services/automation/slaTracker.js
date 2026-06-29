const pool = require('../../db/pool');
const { triggerAutomation } = require('../automationEngine');

async function checkSlaBreaches() {
  try {
    const tenantsRes = await pool.query('SELECT id FROM tenants WHERE deleted_at IS NULL');
    for (const t of tenantsRes.rows) {
      await checkTenantSlaBreaches(t.id);
      await checkTenantOverdueFollowups(t.id);
    }
  } catch (err) {
    console.error('[SLA Tracker] Error fetching tenants for SLA tracker:', err);
  }
}

async function checkTenantOverdueFollowups(tenantId) {
  const overdueQuery = `
    SELECT f.id, f.lead_id, f.title, EXTRACT(DAY FROM CURRENT_TIMESTAMP - f.due_at) as overdue_days
    FROM lead_followups f
    WHERE f.tenant_id = $1 AND f.is_done = FALSE AND f.due_at < CURRENT_TIMESTAMP
  `;
  try {
    const overdues = await pool.query(overdueQuery, [tenantId]);
    if (overdues.rows.length === 0) return;

    // Find managers to notify
    const managersRes = await pool.query(`
      SELECT u.id 
      FROM users u 
      JOIN roles r ON u.role_id = r.id 
      WHERE u.tenant_id = $1 AND r.name IN ('manager', 'gm') AND u.status = 'active' AND u.deleted_at IS NULL
    `, [tenantId]);

    const managers = managersRes.rows;

    for (const overdue of overdues.rows) {
      // Escalate if overdue by 1 or more days
      if (overdue.overdue_days >= 1) {
        const msg = `Escalation: Follow-up '${overdue.title}' is overdue by ${Math.floor(overdue.overdue_days)} days.`;

        // Check if we already escalated this specific follow-up today
        const checkTimeline = await pool.query(`
          SELECT id FROM lead_timeline 
          WHERE tenant_id = $1 AND lead_id = $2 AND event_type = 'system.escalation' 
          AND summary = $3 AND created_at >= CURRENT_DATE
        `, [tenantId, overdue.lead_id, msg]);

        if (checkTimeline.rows.length === 0) {
          // 1. Log in lead timeline
          await pool.query(`
            INSERT INTO lead_timeline (tenant_id, lead_id, event_type, summary)
            VALUES ($1, $2, 'system.escalation', $3)
          `, [tenantId, overdue.lead_id, msg]);

          // 2. Notify managers
          for (const manager of managers) {
            await pool.query(`
              INSERT INTO notifications (tenant_id, user_id, type, message, reference_url)
              VALUES ($1, $2, 'escalation', $3, $4)
            `, [tenantId, manager.id, msg, `/leads/${overdue.lead_id}`]);
          }

          console.log(`[SLA Tracker] Escalated overdue follow-up ${overdue.id} for lead ${overdue.lead_id} in tenant ${tenantId}`);
        }
      }
    }
  } catch (err) {
    console.error(`[SLA Tracker] Error checking overdue followups for tenant ${tenantId}:`, err);
  }
}

async function checkTenantSlaBreaches(tenantId) {
  const query = `
    SELECT l.*, 
           s.name AS stage_name, s.max_days_in_stage,
           COALESCE(EXTRACT(DAY FROM CURRENT_TIMESTAMP - COALESCE(l.stage_updated_at, l.updated_at)), 0) AS days_in_stage
    FROM leads l
    JOIN lead_stages s ON l.stage_id = s.id
    WHERE l.tenant_id = $1 AND l.status != 'converted' AND l.deleted_at IS NULL
  `;
  
  try {
    const res = await pool.query(query, [tenantId]);
    const leads = res.rows;
    
    for (const lead of leads) {
      if (lead.max_days_in_stage && lead.days_in_stage > lead.max_days_in_stage) {
        // Check if we already alerted them today
        const checkAlert = await pool.query(`
          SELECT id FROM lead_timeline 
          WHERE tenant_id = $1 AND lead_id = $2 AND event_type = 'system.sla_breach' 
          AND created_at >= CURRENT_DATE
        `, [tenantId, lead.id]);
        
        if (checkAlert.rows.length === 0) {
          const msg = `SLA Breached: Lead has been in ${lead.stage_name} for ${lead.days_in_stage} days (Limit: ${lead.max_days_in_stage} days).`;
          
          await pool.query(`
            INSERT INTO lead_timeline (tenant_id, lead_id, event_type, summary)
            VALUES ($1, $2, 'system.sla_breach', $3)
          `, [tenantId, lead.id, msg]);
          
          // Trigger full automation for the SLA breach
          await triggerAutomation('sla_breached', lead, { stageName: lead.stage_name });
          
          console.log(`[SLA Tracker] Breached SLA for lead ${lead.id} in tenant ${tenantId}`);
        }
      }
    }
  } catch (err) {
    console.error(`[SLA Tracker] Error checking SLA breaches for tenant ${tenantId}:`, err);
  }
}

function startSlaTracking() {
  // Run once an hour
  setInterval(checkSlaBreaches, 3600000);
  console.log('[SLA Tracker] Started (runs every 1 hour)');
}

module.exports = { startSlaTracking, checkSlaBreaches, checkTenantOverdueFollowups };
