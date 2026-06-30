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

  // 2.5. Validate task dependencies if status changes to 'in_progress' or 'done'
  if (data.status && (data.status === 'in_progress' || data.status === 'done') && data.status !== currentTask.status) {
    const { rows: projRows } = await pool.query(
      'SELECT enforce_dependencies FROM projects WHERE id = $1 AND tenant_id = $2',
      [currentTask.project_id, tenantId]
    );
    const enforceDeps = projRows[0]?.enforce_dependencies;
    
    if (enforceDeps !== false) {
      const taskDependencyRepository = require('../../repositories/taskDependencyRepository');
      const dependencies = await taskDependencyRepository.findDependenciesForTask(tenantId, taskId);
      
      for (const dep of dependencies) {
        const isFS = dep.dependency_type === 'finish-to-start';
        const isSS = dep.dependency_type === 'start-to-start';
        
        if (isFS) {
          if (dep.depends_on_task_status !== 'done') {
            const err = new Error('DEPENDENCY_UNSATISFIED');
            err.status = 400;
            err.code = 'DEPENDENCY_UNSATISFIED';
            err.message = `Cannot start/complete task: Prerequisite task '${dep.depends_on_task_title}' must be completed first.`;
            throw err;
          }

          // Factory-to-Project timeline linkage checks
          const currentTitleLower = (currentTask.title || '').toLowerCase();
          const depTitleLower = (dep.depends_on_task_title || '').toLowerCase();
          const isInstallation = currentTitleLower.includes('installation') || currentTitleLower.includes('assembly');
          const isFactory = depTitleLower.includes('factory') || depTitleLower.includes('production') || depTitleLower.includes('manufacturing');

          if (isInstallation && isFactory) {
            // 1. Check if production orders exist for this project
            const { rows: poCountRows } = await pool.query(
              'SELECT COUNT(*)::int as count FROM production_orders WHERE project_id = $1 AND tenant_id = $2',
              [currentTask.project_id, tenantId]
            );
            const poCount = poCountRows[0]?.count || 0;

            if (poCount === 0) {
              const err = new Error('FACTORY_PRODUCTION_REQUIRED');
              err.status = 400;
              err.code = 'FACTORY_PRODUCTION_REQUIRED';
              err.message = `Cannot start task '${currentTask.title}': Factory production must be scheduled and completed first.`;
              throw err;
            }

            // 2. Check if all scheduled production orders have been delivered and received at site
            const { rows: poDeliveredRows } = await pool.query(
              `SELECT COUNT(DISTINCT po.id)::int as count 
               FROM production_orders po
               JOIN production_dispatches pd ON po.id = pd.production_order_id
               WHERE po.project_id = $1 AND po.tenant_id = $2 AND pd.status = 'delivered'`,
              [currentTask.project_id, tenantId]
            );
            const deliveredCount = poDeliveredRows[0]?.count || 0;

            if (deliveredCount < poCount) {
              // Let's check if there are dispatches at all
              const { rows: dispatchCheckRows } = await pool.query(
                'SELECT status FROM production_dispatches WHERE project_id = $1 AND tenant_id = $2',
                [currentTask.project_id, tenantId]
              );
              
              if (dispatchCheckRows.length === 0) {
                const err = new Error('FACTORY_DISPATCH_REQUIRED');
                err.status = 400;
                err.code = 'FACTORY_DISPATCH_REQUIRED';
                err.message = `Cannot start task '${currentTask.title}': Factory dispatch must be confirmed first.`;
                throw err;
              } else {
                const err = new Error('MATERIAL_RECEIPT_REQUIRED');
                err.status = 400;
                err.code = 'MATERIAL_RECEIPT_REQUIRED';
                err.message = `Cannot start task '${currentTask.title}': Material receipt at site has not been recorded yet.`;
                throw err;
              }
            }
          }
        }
        
        if (isSS && dep.depends_on_task_status !== 'in_progress' && dep.depends_on_task_status !== 'done') {
          const err = new Error('DEPENDENCY_UNSATISFIED');
          err.status = 400;
          err.code = 'DEPENDENCY_UNSATISFIED';
          err.message = `Cannot start/complete task: Prerequisite task '${dep.depends_on_task_title}' must be started first.`;
          throw err;
        }
      }
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
  if (data.due_date && data.due_date !== currentTask.due_date) {
    const { recalculateSchedule } = require('../projects/scheduleRecalculator');
    recalculateSchedule({
      tenantId,
      projectId: currentTask.project_id,
      triggerType: 'task_date_changed',
      triggerName: currentTask.title
    }).catch(err => {
      console.error('[UpdateTask] Error recalculating schedule:', err);
    });
  }

  // Auto-link factory to installation tasks if the title changed and this is a project task
  if (data.title && updatedTask.project_id) {
    const { autoLinkFactoryToInstallationTasks } = require('./autoLinkService');
    await autoLinkFactoryToInstallationTasks(tenantId, updatedTask.project_id);
  }

  return updatedTask;
}

module.exports = { updateTask };
