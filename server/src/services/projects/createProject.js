const projectRepository = require('../../repositories/projectRepository');
const templateService = require('../templates/templateService');
const { logAction } = require('../auditLog');
const { enqueueAutomation } = require('../../queues/automationQueue');
const pool = require('../../config/db');

async function createProject({ tenantId, userId, data }) {
  const { templateId, ...projectData } = data;
  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Create the base project
    const project = await projectRepository.createProject(tenantId, { 
      ...projectData, 
      created_by: userId 
    }, client);

    // 2. Hydrate via template if requested
    if (templateId) {
      try {
        await templateService.applyTemplate(project.id, templateId, tenantId, client);
      } catch (error) {
        console.error(`Failed to apply template ${templateId} to project ${project.id}:`, error);
        throw error; // Let the transaction rollback
      }
    }

    await client.query('COMMIT');

    // 3. Log the action (after commit)
    await logAction({
      tenantId,
      userId,
      action: 'project.created',
      entity: 'project',
      entityId: project.id,
      newValue: { name: project.name, client_name: project.client_name }
    });

    // 4. Trigger automation engine
    await enqueueAutomation({
      tenantId,
      eventType: 'record.created',
      entity: 'project',
      record: project
    });

    return project;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { createProject };
