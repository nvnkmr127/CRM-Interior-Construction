const pool = require('../../config/db');
const taskRepository = require('../../repositories/taskRepository');
const { logAction } = require('../auditLog');
const { enqueueAutomation } = require('../../queues/automationQueue');

async function createTask({ tenantId, userId, data }) {
  // Map incoming camelCase variables to snake_case for the repository if necessary
  const mappedData = {
    project_id: data.projectId || data.project_id,
    lead_id: data.leadId || data.lead_id,
    milestone_id: data.milestoneId || data.milestone_id,
    parent_task_id: data.parentTaskId || data.parent_task_id,
    title: data.title,
    description: data.description,
    assignee_id: data.assigneeId || data.assignee_id,
    due_date: data.dueDate || data.due_date,
    start_date: data.startDate || data.start_date,
    duration_days: data.durationDays || data.duration_days,
    priority: data.priority,
    tags: data.tags,
    custom_fields: data.customFields || data.custom_fields,
    room_name: data.roomName || data.room_name
  };

  if (!mappedData.project_id && !mappedData.lead_id) {
    const error = new Error('Project ID or Lead ID is required');
    error.status = 400;
    throw error;
  }

  // 1. Verify milestone association securely against the project and tenant context
  if (mappedData.milestone_id) {
    const { rows } = await pool.query(
      `SELECT m.id, p.is_execution, p.project_id 
       FROM milestones m 
       JOIN project_phases p ON m.phase_id = p.id
       WHERE m.id = $1 AND m.project_id = $2 AND m.tenant_id = $3`,
      [mappedData.milestone_id, mappedData.project_id, tenantId]
    );
    if (rows.length === 0) {
      const err = new Error('INVALID_MILESTONE');
      err.status = 400;
      err.code = 'INVALID_MILESTONE';
      err.details = 'Milestone does not exist or does not belong to this project.';
      throw err;
    }

    const milestoneInfo = rows[0];
    if (milestoneInfo.is_execution) {
      // 1. Verify design is frozen (scope lock)
      const { rows: projRows } = await pool.query(
        'SELECT is_scope_locked FROM projects WHERE id = $1 AND tenant_id = $2',
        [mappedData.project_id, tenantId]
      );
      const isLocked = projRows[0]?.is_scope_locked;
      if (!isLocked) {
        const err = new Error('DESIGN_NOT_FROZEN');
        err.status = 400;
        err.code = 'DESIGN_NOT_FROZEN';
        err.details = 'Cannot create task in an execution phase (procurement/production) until the design is frozen.';
        throw err;
      }

      // 2. Verify quotation is accepted with client confirmation date recorded
      const { rows: quoteRows } = await pool.query(
        `SELECT id, accepted_at FROM quotations 
         WHERE project_id = $1 AND tenant_id = $2 AND status = 'accepted'
         ORDER BY version DESC, created_at DESC 
         LIMIT 1`,
        [mappedData.project_id, tenantId]
      );
      if (quoteRows.length === 0 || !quoteRows[0].accepted_at) {
        const err = new Error('QUOTATION_NOT_ACCEPTED');
        err.status = 400;
        err.code = 'QUOTATION_NOT_ACCEPTED';
        err.details = 'Cannot create task in an execution phase (procurement/production) until the BOQ quotation is accepted by the client.';
        throw err;
      }
    }
  }

  // 2. Verify parent task association securely against the project/lead and tenant context
  if (mappedData.parent_task_id) {
    let parentCheckQuery = 'SELECT id FROM tasks WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL';
    const parentCheckParams = [mappedData.parent_task_id, tenantId];
    
    if (mappedData.project_id) {
      parentCheckQuery += ' AND project_id = $3';
      parentCheckParams.push(mappedData.project_id);
    } else if (mappedData.lead_id) {
      parentCheckQuery += ' AND lead_id = $3';
      parentCheckParams.push(mappedData.lead_id);
    } else {
      parentCheckQuery += ' AND project_id IS NULL AND lead_id IS NULL';
    }

    const { rows } = await pool.query(parentCheckQuery, parentCheckParams);
    if (rows.length === 0) {
      const err = new Error('INVALID_PARENT_TASK');
      err.status = 400;
      err.code = 'INVALID_PARENT_TASK';
      err.details = 'Parent task does not exist or does not belong to this project/lead.';
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
