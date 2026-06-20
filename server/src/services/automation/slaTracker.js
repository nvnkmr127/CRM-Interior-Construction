const pool = require('../../db/pool');
const { triggerAutomation } = require('../automationEngine');

async function checkSlaBreaches() {
  const query = `
    SELECT l.*, 
           s.name AS stage_name, s.max_days_in_stage,
           COALESCE(EXTRACT(DAY FROM CURRENT_TIMESTAMP - COALESCE(l.stage_updated_at, l.updated_at)), 0) AS days_in_stage
    FROM leads l
    JOIN lead_stages s ON l.stage_id = s.id
    WHERE l.status != 'converted' AND l.deleted_at IS NULL
  `;
  
  try {
    const res = await pool.query(query);
    const leads = res.rows;
    
    for (const lead of leads) {
      if (lead.max_days_in_stage && lead.days_in_stage > lead.max_days_in_stage) {
        // SLA Breached
        // We can create a system activity or alert the manager
        
        // Check if we already alerted them today
        const checkAlert = await pool.query(`
          SELECT id FROM lead_activities 
          WHERE lead_id = $1 AND type = 'system' AND summary LIKE 'SLA Breached%' 
          AND created_at >= CURRENT_DATE
        `, [lead.id]);
        
        if (checkAlert.rows.length === 0) {
          const msg = `SLA Breached: Lead has been in ${lead.stage_name} for ${lead.days_in_stage} days (Limit: ${lead.max_days_in_stage} days).`;
          
          await pool.query(`
            INSERT INTO lead_activities (lead_id, type, summary, logged_by)
            VALUES ($1, 'system', $2, NULL)
          `, [lead.id, msg]);
          
          // Optionally trigger full automation
          // await triggerAutomation('sla_breached', lead, { stageName: lead.stage_name });
          
          console.log(`[SLA Tracker] Breached SLA for lead ${lead.id}`);
        }
      }
    }
  } catch (err) {
    console.error('[SLA Tracker] Error checking SLA breaches:', err);
  }
}

function startSlaTracking() {
  // Run once an hour
  setInterval(checkSlaBreaches, 3600000);
  console.log('[SLA Tracker] Started (runs every 1 hour)');
}

module.exports = { startSlaTracking, checkSlaBreaches };
