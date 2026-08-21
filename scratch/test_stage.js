const pool = require('../server/src/db/pool');

async function run() {
  try {
    const leadRes = await pool.query('SELECT id, name, tenant_id, stage_id FROM leads WHERE deleted_at IS NULL LIMIT 5');
    console.log('Leads:', leadRes.rows);
    
    if (leadRes.rows.length > 0) {
      const lead = leadRes.rows[0];
      const stagesRes = await pool.query('SELECT id, name FROM lead_stages WHERE tenant_id = $1', [lead.tenant_id]);
      console.log('Stages for tenant:', stagesRes.rows);
      
      if (stagesRes.rows.length > 1) {
        const currentStageIdx = stagesRes.rows.findIndex(s => s.id === lead.stage_id);
        const newStage = stagesRes.rows[(currentStageIdx + 1) % stagesRes.rows.length];
        
        console.log(`Attempting to update lead ${lead.id} stage from ${lead.stage_id} to ${newStage.id}...`);
        
        // Find a valid user id
        const userRes = await pool.query('SELECT id FROM users WHERE tenant_id = $1 LIMIT 1', [lead.tenant_id]);
        const userId = userRes.rows[0]?.id || '00000000-0000-0000-0000-000000000000';
        
        const { changeStage } = require('../server/src/services/leads/changeStage');
        
        // Mock req params
        const updated = await changeStage({
          tenantId: lead.tenant_id,
          userId: userId,
          leadId: lead.id,
          newStageId: newStage.id
        });
        
        console.log('Updated lead stage in DB:', updated.stage_id);
      }
    }
  } catch (e) {
    console.error('Error during test:', e);
  } finally {
    await pool.end();
  }
}

run();
