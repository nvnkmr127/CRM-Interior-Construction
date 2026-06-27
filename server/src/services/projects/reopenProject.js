const pool = require('../../config/db');
const { logAction } = require('../auditLog');

/**
 * Helper: Calculate difference in calendar days
 */
function diffDays(d1, d2) {
  const oneDay = 24 * 60 * 60 * 1000;
  const date1 = new Date(d1);
  const date2 = new Date(d2);
  date1.setHours(0,0,0,0);
  date2.setHours(0,0,0,0);
  return Math.round((date1 - date2) / oneDay);
}

/**
 * Reopen a completed, cancelled, or archived project with a new start date,
 * shifting all task and phase schedules accordingly.
 */
async function reopenProject({ projectId, tenantId, userId, newStartDate, newTargetDate }) {
  // Fetch current project
  const currentRes = await pool.query(
    'SELECT id, name, status, start_date, target_date FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
    [projectId, tenantId]
  );
  if (currentRes.rows.length === 0) {
    const err = new Error('PROJECT_NOT_FOUND');
    err.status = 404;
    throw err;
  }
  const project = currentRes.rows[0];

  if (project.status === 'active') {
    const err = new Error('PROJECT_ALREADY_ACTIVE');
    err.message = 'Project is already active.';
    err.status = 400;
    throw err;
  }

  // Calculate shift offset in days
  let daysShift = 0;
  if (project.start_date && newStartDate) {
    daysShift = diffDays(newStartDate, project.start_date);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Shift tasks, milestones, and phases if start_date shifted
    if (daysShift !== 0) {
      // Shift tasks
      await client.query(
        `UPDATE tasks 
         SET start_date = (start_date::timestamp + ($1 || ' day')::interval)::date,
             due_date = (due_date::timestamp + ($1 || ' day')::interval)::date,
             updated_at = NOW()
         WHERE project_id = $2 AND tenant_id = $3 AND deleted_at IS NULL 
           AND start_date IS NOT NULL AND due_date IS NOT NULL`,
        [daysShift, projectId, tenantId]
      );

      // Shift milestones
      await client.query(
        `UPDATE milestones 
         SET due_date = (due_date::timestamp + ($1 || ' day')::interval)::date
         WHERE project_id = $2 AND tenant_id = $3 
           AND due_date IS NOT NULL`,
        [daysShift, projectId, tenantId]
      );

      // Shift project phases
      await client.query(
        `UPDATE project_phases 
         SET starts_at = (starts_at::timestamp + ($1 || ' day')::interval)::date,
             ends_at = (ends_at::timestamp + ($1 || ' day')::interval)::date
         WHERE project_id = $2 AND tenant_id = $3 
           AND starts_at IS NOT NULL AND ends_at IS NOT NULL`,
        [daysShift, projectId, tenantId]
      );
    }

    // 2. Record schedule revision in project_schedule_revisions
    const { rows: revRows } = await client.query(
      'SELECT MAX(revision_number) as max_rev FROM project_schedule_revisions WHERE project_id = $1 AND tenant_id = $2',
      [projectId, tenantId]
    );
    const nextRev = (revRows[0]?.max_rev || 0) + 1;
    const finalTargetDate = newTargetDate || project.target_date;

    await client.query(
      `INSERT INTO project_schedule_revisions (
        tenant_id, project_id, revised_by, previous_start_date, previous_target_date, 
        new_start_date, new_target_date, reason, revision_number
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)`,
      [
        tenantId,
        projectId,
        userId,
        project.start_date,
        project.target_date,
        newStartDate,
        finalTargetDate,
        'Project reopened and revived',
        nextRev
      ]
    );

    // 3. Update project status and dates
    const updateRes = await client.query(
      `UPDATE projects 
       SET status = 'active', start_date = $1, target_date = $2, updated_at = NOW()
       WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL
       RETURNING *`,
      [newStartDate, finalTargetDate, projectId, tenantId]
    );
    const updatedProject = updateRes.rows[0];

    // 4. Log audit action
    await logAction({
      tenantId,
      userId,
      action: 'project.reopened',
      entity: 'project',
      entityId: projectId,
      oldValue: { status: project.status, start_date: project.start_date, target_date: project.target_date },
      newValue: { status: 'active', start_date: newStartDate, target_date: finalTargetDate }
    }, client);

    await client.query('COMMIT');
    return updatedProject;

  } catch (err) {
    await client.query('ROLLBACK');
    throw err;
  } finally {
    client.release();
  }
}

module.exports = { reopenProject };
