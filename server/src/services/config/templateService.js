const pool = require('../../db/pool');

/**
 * Retrieves all active project templates for a tenant.
 */
async function getTemplates(tenantId) {
  const query = `
    SELECT id, name, project_type, description, phases, is_active, created_by, created_at, updated_at
    FROM project_templates
    WHERE tenant_id = $1 AND is_active = true
    ORDER BY created_at DESC
  `;
  const result = await pool.query(query, [tenantId]);
  return result.rows;
}

/**
 * Creates a new project template.
 */
async function createTemplate(tenantId, userId, templateData) {
  const { name, project_type, description, phases = [] } = templateData;

  if (!Array.isArray(phases)) {
    throw new Error('Phases must be an array');
  }

  const query = `
    INSERT INTO project_templates (tenant_id, created_by, name, project_type, description, phases)
    VALUES ($1, $2, $3, $4, $5, $6::jsonb)
    RETURNING id, name, project_type, description, phases, is_active, created_by, created_at, updated_at
  `;
  
  const result = await pool.query(query, [
    tenantId, 
    userId, 
    name, 
    project_type, 
    description, 
    JSON.stringify(phases)
  ]);
  
  return result.rows[0];
}

/**
 * Updates an existing project template.
 */
async function updateTemplate(tenantId, templateId, updates) {
  const allowedFields = ['name', 'project_type', 'description', 'phases', 'is_active'];
  const sets = [];
  const values = [tenantId, templateId];
  let paramIndex = 3;

  for (const [key, value] of Object.entries(updates)) {
    if (allowedFields.includes(key)) {
      sets.push(`${key} = $${paramIndex}`);
      values.push(key === 'phases' ? JSON.stringify(value) : value);
      paramIndex++;
    }
  }

  if (sets.length === 0) {
    throw new Error('No valid fields provided for update');
  }

  sets.push(`updated_at = NOW()`);

  const query = `
    UPDATE project_templates
    SET ${sets.join(', ')}
    WHERE id = $2 AND tenant_id = $1
    RETURNING id, name, project_type, description, phases, is_active, created_by, created_at, updated_at
  `;

  const result = await pool.query(query, values);
  
  if (result.rows.length === 0) {
    throw new Error('NOT_FOUND');
  }

  return result.rows[0];
}

/**
 * Applies a project template to a specific project.
 * Uses a transactional boundary to safely spawn phases and milestones.
 */
async function applyTemplate(projectId, templateId, tenantId) {
  const client = await pool.connect();
  
  try {
    await client.query('BEGIN');

    // 1. Fetch template
    const templateRes = await client.query(`
      SELECT phases FROM project_templates
      WHERE id = $1 AND tenant_id = $2 AND is_active = true
    `, [templateId, tenantId]);

    if (templateRes.rows.length === 0) {
      throw new Error('TEMPLATE_NOT_FOUND');
    }

    const template = templateRes.rows[0];
    const phases = template.phases || [];
    
    // Optionally: Validate project existence here if required before proceeding
    // We assume the project exists and foreign key constraints on project_phases will catch ghosts.

    let phasesCreated = 0;
    let milestonesCreated = 0;

    // 2. Map schema and execute phase loop
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      
      const phaseQuery = `
        INSERT INTO project_phases (project_id, tenant_id, name, "order", duration_days)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING id
      `;
      const phaseRes = await client.query(phaseQuery, [
        projectId, 
        tenantId, 
        phase.name, 
        i + 1, // Start order numbering sequentially at 1
        phase.duration_days || 0
      ]);
      
      const phaseId = phaseRes.rows[0].id;
      phasesCreated++;

      const milestones = phase.milestones || [];
      for (const milestone of milestones) {
        const milestoneQuery = `
          INSERT INTO milestones (phase_id, project_id, tenant_id, name, triggers_payment)
          VALUES ($1, $2, $3, $4, $5)
        `;
        await client.query(milestoneQuery, [
          phaseId, 
          projectId, 
          tenantId, 
          milestone.name, 
          milestone.triggers_payment || false
        ]);
        milestonesCreated++;
      }
    }

    await client.query('COMMIT');
    
    // 3. Return execution summary
    return { phasesCreated, milestonesCreated };
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = {
  getTemplates,
  createTemplate,
  updateTemplate,
  applyTemplate
};
