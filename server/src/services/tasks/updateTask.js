const taskRepository = require('../../repositories/taskRepository');
const { logAction } = require('../auditLog');
const { enqueueAutomation } = require('../../queues/automationQueue');
const pool = require('../../config/db');

async function updateTask({ tenantId, userId, taskId, data }) {
  // 1. Fetch current task to safely establish baseline
  const currentTask = await taskRepository.findTaskById(tenantId, taskId);
  if (!currentTask) {
    const error = new Error('NOT_FOUND');
    error.status = 404;
    throw error;
  }

  // 1.5. Validate design freeze and quotation acceptance for execution phase tasks when changing status from todo/pending/draft
  if (data.status && data.status !== 'todo' && currentTask.status === 'todo') {
    if (currentTask.milestone_id) {
      const { rows } = await pool.query(
        `SELECT p.is_execution 
         FROM milestones m 
         JOIN project_phases p ON m.phase_id = p.id
         WHERE m.id = $1 AND m.tenant_id = $2`,
        [currentTask.milestone_id, tenantId]
      );
      if (rows.length > 0 && rows[0].is_execution) {
        // 1. Verify design is frozen (scope lock)
        const { rows: projRows } = await pool.query(
          'SELECT is_scope_locked FROM projects WHERE id = $1 AND tenant_id = $2',
          [currentTask.project_id, tenantId]
        );
        const isLocked = projRows[0]?.is_scope_locked;
        if (!isLocked) {
          const err = new Error('DESIGN_NOT_FROZEN');
          err.status = 400;
          err.code = 'DESIGN_NOT_FROZEN';
          err.message = 'Cannot trigger execution tasks: Design must be frozen before starting procurement or production.';
          throw err;
        }

        // 2. Verify quotation is accepted with client confirmation date recorded
        const { rows: quoteRows } = await pool.query(
          `SELECT id, accepted_at FROM quotations 
           WHERE project_id = $1 AND tenant_id = $2 AND status = 'accepted'
           ORDER BY version DESC, created_at DESC 
           LIMIT 1`,
          [currentTask.project_id, tenantId]
        );
        if (quoteRows.length === 0 || !quoteRows[0].accepted_at) {
          const err = new Error('QUOTATION_NOT_ACCEPTED');
          err.status = 400;
          err.code = 'QUOTATION_NOT_ACCEPTED';
          err.message = 'Cannot trigger execution tasks: BOQ quotation must be accepted by the client before starting procurement or production.';
          throw err;
        }
      }
    }
  }

  // 2. Validate structural integrity if user is marking task as 'done'
  if (data.status === 'done' && currentTask.status !== 'done') {
    const { rows: subtasks } = await pool.query(
      "SELECT id, status FROM tasks WHERE parent_task_id = $1 AND tenant_id = $2 AND deleted_at IS NULL",
      [taskId, tenantId]
    );
    const incompleteSubtasks = subtasks.filter(t => t.status !== 'done');
    
    if (incompleteSubtasks.length > 0) {
      const error = new Error('SUBTASKS_INCOMPLETE');
      error.status = 400;
      error.code = 'SUBTASKS_INCOMPLETE';
      error.details = `Cannot complete parent task. There are ${incompleteSubtasks.length} pending subtasks remaining.`;
      throw error;
    }
  }

  // 3. Push data to database 
  const updatedTask = await taskRepository.updateTask(tenantId, taskId, data);

  // Identify exact delta footprint
  const oldValues = {};
  const newValues = {};
  for (const key of Object.keys(data)) {
    if (currentTask[key] !== updatedTask[key]) {
      oldValues[key] = currentTask[key];
      newValues[key] = updatedTask[key];
    }
  }

  // 4. Audit Log Injection
  if (Object.keys(newValues).length > 0) {
    await logAction({
      tenantId,
      userId,
      action: 'task.updated',
      entity: 'task',
      entityId: taskId,
      oldValue: oldValues,
      newValue: newValues
    });
  }

  // 5. Fire external workflows if task status changes specifically
  if (data.status && data.status !== currentTask.status) {
    await enqueueAutomation({
      tenantId,
      eventType: 'field.changed',
      entity: 'task',
      record: updatedTask,
      changes: {
        field: 'status',
        oldValue: currentTask.status,
        newValue: updatedTask.status
      }
    });
  }

  // 6. Output fresh database row
  return updatedTask;
}

module.exports = { updateTask };
