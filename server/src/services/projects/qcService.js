const pool = require('../../config/db');

async function getTemplates(tenantId) {
  const templatesRes = await pool.query(
    'SELECT * FROM qc_stage_templates WHERE tenant_id = $1 AND is_active = true ORDER BY sort_order',
    [tenantId]
  );
  
  if (templatesRes.rows.length === 0) return [];
  
  const templateIds = templatesRes.rows.map(r => r.id);
  const itemsRes = await pool.query(
    'SELECT * FROM qc_checklist_template_items WHERE template_id = ANY($1::uuid[]) ORDER BY sort_order',
    [templateIds]
  );
  
  const templates = templatesRes.rows.map(template => {
    return {
      ...template,
      items: itemsRes.rows.filter(item => item.template_id === template.id)
    };
  });
  
  return templates;
}

async function getProjectQcStages(tenantId, projectId) {
  const stagesRes = await pool.query(
    'SELECT * FROM project_qc_stages WHERE tenant_id = $1 AND project_id = $2 ORDER BY created_at',
    [tenantId, projectId]
  );
  
  if (stagesRes.rows.length === 0) return [];
  
  const stageIds = stagesRes.rows.map(s => s.id);
  const itemsRes = await pool.query(
    'SELECT * FROM project_qc_checklist_items WHERE stage_id = ANY($1::uuid[]) ORDER BY id',
    [stageIds]
  );
  
  const stages = stagesRes.rows.map(stage => {
    return {
      ...stage,
      items: itemsRes.rows.filter(item => item.stage_id === stage.id)
    };
  });
  
  return stages;
}

async function initializeQcStage(tenantId, projectId, phaseId, templateId) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Get template
    const templateRes = await client.query('SELECT * FROM qc_stage_templates WHERE id = $1 AND tenant_id = $2', [templateId, tenantId]);
    if (templateRes.rows.length === 0) throw new Error('Template not found');
    const template = templateRes.rows[0];
    
    // Create stage
    const stageRes = await client.query(
      `INSERT INTO project_qc_stages (tenant_id, project_id, phase_id, stage_name, status) 
       VALUES ($1, $2, $3, $4, 'pending') RETURNING *`,
      [tenantId, projectId, phaseId, template.stage_name]
    );
    const stage = stageRes.rows[0];
    
    // Copy items
    const itemsRes = await client.query('SELECT * FROM qc_checklist_template_items WHERE template_id = $1 ORDER BY sort_order', [templateId]);
    
    for (const item of itemsRes.rows) {
      await client.query(
        `INSERT INTO project_qc_checklist_items (stage_id, item_text, is_photo_mandatory) 
         VALUES ($1, $2, $3)`,
        [stage.id, item.item_text, item.is_photo_mandatory]
      );
    }
    
    await client.query('COMMIT');
    return await getProjectQcStages(tenantId, projectId); // Return all to refresh frontend
  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

async function updateChecklistItem(tenantId, stageId, itemId, payload) {
  const { is_passed, photo_url, notes, userId } = payload;
  
  // Update item
  const updateRes = await pool.query(
    `UPDATE project_qc_checklist_items 
     SET is_passed = COALESCE($1, is_passed),
         photo_url = COALESCE($2, photo_url),
         notes = COALESCE($3, notes),
         checked_by = $4,
         checked_at = NOW()
     WHERE id = $5 AND stage_id = $6
     RETURNING *`,
    [is_passed, photo_url, notes, userId, itemId, stageId]
  );
  
  if (updateRes.rows.length === 0) throw new Error('Item not found');
  
  // Update stage status if it was pending
  await pool.query(
    `UPDATE project_qc_stages SET status = 'in_progress', updated_at = NOW() 
     WHERE id = $1 AND status = 'pending'`,
    [stageId]
  );
  
  return updateRes.rows[0];
}

async function signOffStage(tenantId, projectId, stageId, userId) {
  // Validate all items are passed and photos provided if mandatory
  const itemsRes = await pool.query('SELECT * FROM project_qc_checklist_items WHERE stage_id = $1', [stageId]);
  
  for (const item of itemsRes.rows) {
    if (item.is_passed !== true) {
      throw new Error(\`Cannot sign off: Item "\${item.item_text}" is not marked as passed.\`);
    }
    if (item.is_photo_mandatory && !item.photo_url) {
      throw new Error(\`Cannot sign off: Photo is mandatory for "\${item.item_text}".\`);
    }
  }
  
  const updateRes = await pool.query(
    `UPDATE project_qc_stages 
     SET status = 'completed', qc_engineer_id = $1, signed_off_at = NOW(), updated_at = NOW()
     WHERE id = $2 AND tenant_id = $3 AND project_id = $4
     RETURNING *`,
    [userId, stageId, tenantId, projectId]
  );
  
  if (updateRes.rows.length === 0) throw new Error('Stage not found');
  
  return updateRes.rows[0];
}

module.exports = {
  getTemplates,
  getProjectQcStages,
  initializeQcStage,
  updateChecklistItem,
  signOffStage
};
