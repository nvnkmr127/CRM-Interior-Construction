const pool = require('../../config/db');
const taskRepository = require('../../repositories/taskRepository');
const { logAction } = require('../auditLog');
const { enqueueAutomation } = require('../../queues/automationQueue');

async function createTask({ tenantId, userId, data }) {
  // Map incoming camelCase variables to snake_case for the repository if necessary
  const mappedData = {
    project_id: data.projectId || data.project_id,
    milestone_id: data.milestoneId || data.milestone_id,
    parent_task_id: data.parentTaskId || data.parent_task_id,
    title: data.title,
    description: data.description,
    assignee_id: data.assigneeId || data.assignee_id,
    due_date: data.dueDate || data.due_date,
    priority: data.priority,
    tags: data.tags,
    custom_fields: data.customFields || data.custom_fields
  };

  if (!mappedData.project_id) {
    const error = new Error('Project ID is required');
    error.status = 400;
    throw error;
  }

  // 1. Verify milestone association securely against the project and tenant context
  if (mappedData.milestone_id) {
    const { rows } = await pool.query(
      'SELECT id FROM milestones WHERE id = $1 AND project_id = $2 AND tenant_id = $3',
      [mappedData.milestone_id, mappedData.project_id, tenantId]
    );
    if (rows.length === 0) {
      const err = new Error('INVALID_MILESTONE');
      err.status = 400;
      err.details = 'Milestone does not exist or does not belong to this project.';
      throw err;
    }
  }

  // 2. Verify parent task association securely against the project and tenant context
  if (mappedData.parent_task_id) {
    const { rows } = await pool.query(
      'SELECT id FROM tasks WHERE id = $1 AND project_id = $2 AND tenant_id = $3 AND deleted_at IS NULL',
      [mappedData.parent_task_id, mappedData.project_id, tenantId]
    );
    if (rows.length === 0) {
      const err = new Error('INVALID_PARENT_TASK');
      err.status = 400;
      err.details = 'Parent task does not exist or does not belong to this project.';
      throw err;
    }
  }

  // 3. Fire insertion to the Database
  const task = await taskRepository.createTask(tenantId, { 
    ...mappedData, 
    created_by: userId 
  });

  // 4. Record interaction in Audit Log
  await logAction({
    tenantId,
    userId,
    action: 'task.created',
    entity: 'task',
    entityId: task.id,
    newValue: {
      title: task.title,
      project_id: task.project_id
    }
  });

  // 5. Trigger automation pipelines dynamically
  await enqueueAutomation({
    tenantId,
    eventType: 'record.created',
    entity: 'task',
    record: task
  });

  // 6. Return constructed row
  return task;
}

module.exports = { createTask };
