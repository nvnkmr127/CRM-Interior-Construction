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
async function applyTemplate(projectId, templateId, tenantId, passedClient = null) {
  const isExternalClient = !!passedClient;
  const client = passedClient || (await pool.connect());
  
  try {
    if (!isExternalClient) {
      await client.query('BEGIN');
    }

    // 1. Fetch template
    const templateRes = await client.query(`
      SELECT phases FROM project_templates
      WHERE id = $1 AND tenant_id = $2 AND is_active = true
    `, [templateId, tenantId]);

    if (templateRes.rows.length === 0) {
      throw new Error('TEMPLATE_NOT_FOUND');
    }

    // Check project existence
    const projectRes = await client.query(`
      SELECT id FROM projects WHERE id = $1 AND tenant_id = $2
    `, [projectId, tenantId]);

    if (projectRes.rows.length === 0) {
      throw new Error('PROJECT_NOT_FOUND');
    }

    const template = templateRes.rows[0];
    let phases = template.phases || [];
    if (typeof phases === 'string') {
      try { phases = JSON.parse(phases); } catch (e) { phases = []; }
    }
    if (!Array.isArray(phases)) phases = [];

    let phasesCreated = 0;
    let milestonesCreated = 0;

    // 2. Map schema and execute phase loop
    for (let i = 0; i < phases.length; i++) {
      const phase = phases[i];
      
      const status = i === 0 ? 'in_progress' : 'pending';
      const nameLower = (phase.name || '').toLowerCase();
      const isExecution = !(
        nameLower.includes('design') ||
        nameLower.includes('measurement') ||
        nameLower.includes('plan') ||
        nameLower.includes('draft') ||
        nameLower.includes('concept')
      );

      const phaseQuery = `
        INSERT INTO project_phases (project_id, tenant_id, name, sort_order, duration_days, status, is_execution)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING id
      `;
      const phaseRes = await client.query(phaseQuery, [
        projectId, 
        tenantId, 
        phase.name || `Phase ${i + 1}`, 
        i + 1, // Start order numbering sequentially at 1
        Number(phase.duration_days || phase.duration) || 0,
        status,
        isExecution
      ]);
      
      const phaseId = phaseRes.rows[0].id;
      phasesCreated++;

      const milestones = phase.milestones || [];
      for (const milestone of milestones) {
        const milestoneQuery = `
          INSERT INTO milestones (phase_id, project_id, tenant_id, name, triggers_payment)
          VALUES ($1, $2, $3, $4, $5)
          RETURNING id
        `;
        const mRes = await client.query(milestoneQuery, [
          phaseId, 
          projectId, 
          tenantId, 
          milestone.name || 'Untitled Milestone', 
          Boolean(milestone.triggers_payment || milestone.triggersPayment)
        ]);
        const milestoneId = mRes.rows[0]?.id;
        milestonesCreated++;

        if (milestoneId) {
          await client.query(`
            INSERT INTO tasks (tenant_id, project_id, milestone_id, title, status, priority, duration_days)
            VALUES ($1, $2, $3, $4, 'todo', 'medium', $5)
          `, [
            tenantId,
            projectId,
            milestoneId,
            milestone.name || 'Untitled Task',
            Number(phase.duration_days || phase.duration) || 1
          ]);
        }
      }
    }

    if (!isExternalClient) {
      await client.query('COMMIT');
    }
    
    // 3. Return execution summary
    return { phasesCreated, milestonesCreated };
  } catch (error) {
    if (!isExternalClient) {
      await client.query('ROLLBACK');
    }
    throw error;
  } finally {
    if (!isExternalClient) {
      client.release();
    }
  }
}

module.exports = {
  getTemplates,
  createTemplate,
  updateTemplate,
  applyTemplate
};
