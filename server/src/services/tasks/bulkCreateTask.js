const pool = require('../../config/db');
const taskRepository = require('../../repositories/taskRepository');
const { logAction } = require('../auditLog');

async function bulkCreateTasks({ tenantId, userId, projectId, tasks }) {
  if (!tasks || !Array.isArray(tasks) || tasks.length === 0) {
    const err = new Error('No tasks provided for bulk creation.');
    err.status = 400;
    throw err;
  }

  // 1. Validation Constraints
  if (tasks.length > 100) {
    const err = new Error('PAYLOAD_TOO_LARGE');
    err.status = 400;
    err.details = 'Cannot bulk create more than 100 tasks at a time to prevent system abuse.';
    throw err;
  }

  const milestoneIds = new Set();
  
  for (let i = 0; i < tasks.length; i++) {
    const t = tasks[i];
    if (!t.title || !t.title.trim()) {
      const err = new Error('VALIDATION_ERROR');
      err.status = 400;
      err.details = `Task at index ${i} is missing a required title.`;
      throw err;
    }
    
    // Smoothly map frontend camelCase to PostgreSQL snake_case payloads
    t.assignee_id = t.assigneeId || t.assignee_id || null;
    t.milestone_id = t.milestoneId || t.milestone_id || null;
    t.due_date = t.dueDate || t.due_date || null;

    if (t.milestone_id) {
      milestoneIds.add(t.milestone_id);
    }
  }

  // 2. Validate all milestone mappings collectively in a single query
  if (milestoneIds.size > 0) {
    const milestoneIdsArray = Array.from(milestoneIds);
    const { rows } = await pool.query(
      `SELECT id FROM milestones WHERE project_id = $1 AND tenant_id = $2 AND id = ANY($3::uuid[])`,
      [projectId, tenantId, milestoneIdsArray]
    );
    
    if (rows.length !== milestoneIdsArray.length) {
      const err = new Error('INVALID_MILESTONE');
      err.status = 400;
      err.details = 'One or more provided milestones are invalid or do not belong to the target project.';
      throw err;
    }
  }

  // 3. Delegate to Repository
  const mappedTasks = tasks.map(t => ({
    ...t,
    created_by: userId
  }));

  const createdTasks = await taskRepository.bulkCreateTasks(tenantId, projectId, mappedTasks);

  // 4. Batch Audit Logging
  await logAction({
    tenantId,
    userId,
    action: 'task.bulk_created',
    entity: 'project',
    entityId: projectId,
    newValue: {
      count: createdTasks.length
    }
  });

  // Auto-link factory to installation tasks if this is a project task
  if (projectId) {
    const { autoLinkFactoryToInstallationTasks } = require('./autoLinkService');
    await autoLinkFactoryToInstallationTasks(tenantId, projectId);
  }

  return createdTasks;
}

module.exports = { bulkCreateTasks };
