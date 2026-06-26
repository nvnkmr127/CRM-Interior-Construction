const pool = require('../../config/db');
const eventBus = require('../../utils/eventBus');

// Helper: Calculate difference in calendar days
function diffDays(d1, d2) {
  const oneDay = 24 * 60 * 60 * 1000;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  date1.setHours(0,0,0,0);
  date2.setHours(0,0,0,0);
  return Math.round((date1 - date2) / oneDay);
}

// Helper: Add days to Date
function addDays(date, days) {
  const d = new Date(date);
  d.setDate(d.getDate() + days);
  return d;
}

// Helper: Format to YYYY-MM-DD
function toIsoDateStr(d) {
  return new Date(d).toISOString().split('T')[0];
}

async function recalculateSchedule({ tenantId, projectId, triggerType, triggerName }) {
  console.log(`[ScheduleRecalculator] Running cascading schedule recalculation for project ${projectId}. Triggered by ${triggerType} (${triggerName})`);
  
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch project info
    const { rows: projRows } = await client.query(
      'SELECT id, name, start_date, target_date, pm_id, client_name, client_email FROM projects WHERE id = $1 AND tenant_id = $2',
      [projectId, tenantId]
    );
    if (projRows.length === 0) {
      console.log(`[ScheduleRecalculator] Project ${projectId} not found.`);
      await client.query('ROLLBACK');
      return;
    }
    const project = projRows[0];

    // 2. Fetch all tasks of the project
    const { rows: tasks } = await client.query(
      'SELECT id, title, start_date, due_date, duration_days, status, milestone_id FROM tasks WHERE project_id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [projectId, tenantId]
    );

    // 3. Fetch all task dependencies of the project
    const { rows: deps } = await client.query(
      'SELECT task_id, depends_on_task_id, dependency_type FROM task_dependencies WHERE project_id = $1 AND tenant_id = $2',
      [projectId, tenantId]
    );

    if (tasks.length === 0) {
      console.log(`[ScheduleRecalculator] No tasks to reschedule for project ${projectId}.`);
      await client.query('ROLLBACK');
      return;
    }

    // Build task map and dependency graph
    const taskMap = {};
    const adj = {};
    const inDegree = {};

    for (const t of tasks) {
      const sDate = t.start_date ? new Date(t.start_date) : new Date(project.start_date || Date.now());
      const dDate = t.due_date ? new Date(t.due_date) : new Date(sDate);
      const duration = t.duration_days || Math.max(1, diffDays(dDate, sDate) + 1);

      taskMap[t.id] = {
        ...t,
        startDate: sDate,
        dueDate: dDate,
        durationDays: duration,
        shifted: false
      };
      adj[t.id] = [];
      inDegree[t.id] = 0;
    }

    // If a task is late (not done and due_date in the past), project its due_date as today
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const id of Object.keys(taskMap)) {
      const t = taskMap[id];
      if (t.status !== 'done' && t.dueDate < today) {
        console.log(`[ScheduleRecalculator] Task '${t.title}' is late. Projecting its due_date to today.`);
        t.dueDate = new Date(today);
        t.durationDays = Math.max(1, diffDays(t.dueDate, t.startDate) + 1);
        t.shifted = true;
      }
    }

    // Populate graph edges and compute in-degrees
    for (const dep of deps) {
      if (taskMap[dep.task_id] && taskMap[dep.depends_on_task_id]) {
        adj[dep.depends_on_task_id].push(dep);
        inDegree[dep.task_id]++;
      }
    }

    // Topological Sort (Kahn's)
    const queue = [];
    for (const id of Object.keys(taskMap)) {
      if (inDegree[id] === 0) {
        queue.push(id);
      }
    }

    const order = [];
    while (queue.length > 0) {
      const u = queue.shift();
      order.push(u);
      const edges = adj[u] || [];
      for (const edge of edges) {
        inDegree[edge.task_id]--;
        if (inDegree[edge.task_id] === 0) {
          queue.push(edge.task_id);
        }
      }
    }

    // If cycle exists, make sure we still process remaining tasks
    if (order.length < Object.keys(taskMap).length) {
      const visited = new Set(order);
      for (const id of Object.keys(taskMap)) {
        if (!visited.has(id)) {
          order.push(id);
        }
      }
    }

    let scheduleShifted = false;

    // Propagate schedule
    for (const u of order) {
      const t = taskMap[u];
      if (!t) continue;

      const predecessors = deps.filter(d => d.task_id === u);
      let earliestStart = new Date(t.startDate);

      for (const pred of predecessors) {
        const parent = taskMap[pred.depends_on_task_id];
        if (parent) {
          const parentEnd = new Date(parent.dueDate);
          const parentStart = new Date(parent.startDate);

          if (pred.dependency_type === 'finish-to-start') {
            const minStart = addDays(parentEnd, 1);
            if (minStart > earliestStart) {
              earliestStart = minStart;
            }
          } else if (pred.dependency_type === 'start-to-start') {
            if (parentStart > earliestStart) {
              earliestStart = new Date(parentStart);
            }
          }
        }
      }

      if (earliestStart > t.startDate) {
        t.startDate = earliestStart;
        const dur = t.durationDays || 1;
        t.dueDate = addDays(earliestStart, dur - 1);
        t.shifted = true;
        scheduleShifted = true;
      }
    }

    // Update tasks in DB if shifted
    for (const id of Object.keys(taskMap)) {
      const t = taskMap[id];
      await client.query(
        'UPDATE tasks SET start_date = $1, due_date = $2, duration_days = $3, updated_at = NOW() WHERE id = $4 AND tenant_id = $5',
        [toIsoDateStr(t.startDate), toIsoDateStr(t.dueDate), t.durationDays, id, tenantId]
      );
    }

    // 4. Update Milestones in DB
    const { rows: milestones } = await client.query(
      'SELECT id, name, due_date FROM milestones WHERE project_id = $1 AND tenant_id = $2',
      [projectId, tenantId]
    );

    for (const m of milestones) {
      const mTasks = Object.values(taskMap).filter(t => t.milestone_id === m.id);
      if (mTasks.length > 0) {
        const maxDueDate = new Date(Math.max(...mTasks.map(t => t.dueDate)));
        const oldDueDate = m.due_date ? new Date(m.due_date) : null;
        
        if (!oldDueDate || toIsoDateStr(maxDueDate) !== toIsoDateStr(oldDueDate)) {
          await client.query(
            'UPDATE milestones SET due_date = $1 WHERE id = $2 AND tenant_id = $3',
            [toIsoDateStr(maxDueDate), m.id, tenantId]
          );
          scheduleShifted = true;
          console.log(`[ScheduleRecalculator] Milestone '${m.name}' due date recalculated to ${toIsoDateStr(maxDueDate)}`);
        }
      }
    }

    // 5. Update Phases in DB
    const { rows: phases } = await client.query(
      'SELECT id, name, starts_at, ends_at FROM project_phases WHERE project_id = $1 AND tenant_id = $2',
      [projectId, tenantId]
    );

    let maxPhaseEnd = null;

    for (const ph of phases) {
      const phTasks = Object.values(taskMap).filter(t => {
        const m = milestones.find(ms => ms.id === t.milestone_id);
        return (m && m.phase_id === ph.id) || t.milestone_id === ph.id;
      });

      if (phTasks.length > 0) {
        const minStart = new Date(Math.min(...phTasks.map(t => t.startDate)));
        const maxEnd = new Date(Math.max(...phTasks.map(t => t.dueDate)));

        if (!maxPhaseEnd || maxEnd > maxPhaseEnd) {
          maxPhaseEnd = maxEnd;
        }

        const oldStart = ph.starts_at ? new Date(ph.starts_at) : null;
        const oldEnd = ph.ends_at ? new Date(ph.ends_at) : null;

        if (!oldStart || !oldEnd || toIsoDateStr(minStart) !== toIsoDateStr(oldStart) || toIsoDateStr(maxEnd) !== toIsoDateStr(oldEnd)) {
          await client.query(
            'UPDATE project_phases SET starts_at = $1, ends_at = $2 WHERE id = $3 AND tenant_id = $4',
            [toIsoDateStr(minStart), toIsoDateStr(maxEnd), ph.id, tenantId]
          );
          scheduleShifted = true;
          console.log(`[ScheduleRecalculator] Phase '${ph.name}' timeline recalculated to ${toIsoDateStr(minStart)} -> ${toIsoDateStr(maxEnd)}`);
        }
      }
    }

    await client.query('COMMIT');

    // 6. If the schedule changed, emit the shifted event to trigger notifications
    if (scheduleShifted && maxPhaseEnd) {
      const targetDate = project.target_date ? new Date(project.target_date) : null;
      const isBreached = targetDate && maxPhaseEnd > targetDate;
      const overrunDays = isBreached ? diffDays(maxPhaseEnd, targetDate) : 0;

      eventBus.emit('project.schedule_shifted', {
        tenantId,
        projectId,
        projectName: project.name,
        pmId: project.pm_id,
        clientName: project.client_name,
        clientEmail: project.client_email,
        revisedCompletionDate: maxPhaseEnd,
        isBreached,
        overrunDays,
        triggerType,
        triggerName
      });
    }

  } catch (error) {
    await client.query('ROLLBACK');
    console.error('[ScheduleRecalculator] Error running schedule recalculation:', error);
  } finally {
    client.release();
  }
}

module.exports = { recalculateSchedule };
