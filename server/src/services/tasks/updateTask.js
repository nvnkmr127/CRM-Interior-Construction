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
