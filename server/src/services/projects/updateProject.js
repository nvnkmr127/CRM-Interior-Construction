const projectRepository = require('../../repositories/projectRepository');
const { logAction } = require('../auditLog');
const { enqueueAutomation } = require('../../queues/automationQueue');

async function updateProject({ tenantId, userId, projectId, data }) {
  // 1. Fetch current project
  const currentProject = await projectRepository.findProjectById(tenantId, projectId);
  if (!currentProject) {
    const error = new Error('NOT_FOUND');
    error.status = 404;
    throw error;
  }

  // Enforce booking amount gate if project is transitioning to active
  if (data.status === 'active' && currentProject.status !== 'active' && Number(currentProject.booking_amount) > 0) {
    const pool = require('../../db/pool');
    const paymentCheck = await pool.query(
      "SELECT id FROM payment_milestones WHERE project_id = $1 AND tenant_id = $2 AND name = 'Booking Advance' AND status = 'paid' LIMIT 1",
      [projectId, tenantId]
    );
    if (paymentCheck.rows.length === 0) {
      const error = new Error('BOOKING_PAYMENT_REQUIRED');
      error.message = 'Cannot activate project: Booking advance payment has not been received.';
      error.status = 400;
      throw error;
    }
  }

  // 2. Execute update
  const updatedProject = await projectRepository.updateProject(tenantId, projectId, data);

  // 3. Compute changes for audit logging
  const oldValues = {};
  const newValues = {};
  for (const key of Object.keys(data)) {
    if (currentProject[key] !== updatedProject[key]) {
      oldValues[key] = currentProject[key];
      newValues[key] = updatedProject[key];
    }
  }

  if (Object.keys(newValues).length > 0) {
    await logAction({
      tenantId,
      userId,
      action: 'project.updated',
      entity: 'project',
      entityId: projectId,
      oldValue: oldValues,
      newValue: newValues
    });
  }

  // 4. Trigger automation if status explicitly changed
  if (data.status && data.status !== currentProject.status) {
    await enqueueAutomation({
      tenantId,
      eventType: 'field.changed',
      entity: 'project',
      record: updatedProject,
      changes: {
        field: 'status',
        oldValue: currentProject.status,
        newValue: updatedProject.status
      }
    });
  }

  // 5. Return updated project
  return updatedProject;
}

module.exports = { updateProject };
