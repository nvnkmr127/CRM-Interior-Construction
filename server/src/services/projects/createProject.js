const projectRepository = require('../../repositories/projectRepository');
const templateService = require('../templates/templateService');
const { logAction } = require('../auditLog');
const { enqueueAutomation } = require('../../queues/automationQueue');

async function createProject({ tenantId, userId, data }) {
  const { templateId, ...projectData } = data;

  // 1. Create the base project
  const project = await projectRepository.createProject(tenantId, { 
    ...projectData, 
    created_by: userId 
  });

  // 2. Hydrate via template if requested
  if (templateId) {
    try {
      await templateService.applyTemplate(project.id, templateId, tenantId);
    } catch (error) {
      console.error(`Failed to apply template ${templateId} to project ${project.id}:`, error);
    }
  }

  // 3. Log the action
  await logAction({
    tenantId,
    userId,
    action: 'project.created',
    entity: 'project',
    entityId: project.id,
    details: { name: project.name, client_name: project.client_name }
  });

  // 4. Trigger automation engine
  await enqueueAutomation({
    tenantId,
    eventType: 'record.created',
    entity: 'project',
    record: project
  });

  return project;
}

module.exports = { createProject };
