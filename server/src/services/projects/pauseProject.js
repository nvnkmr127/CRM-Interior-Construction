const pool = require('../../db/pool');
const { logAction } = require('../auditLog');

/**
 * Pauses a project, setting status to 'on_hold', loging audit trails, deactivating 
 * site team members (resource reallocation), and saving a client communication record.
 */
async function pauseProject({ projectId, tenantId, userId, reason, expectedResumeDate, clientCommunication }) {
  const currentRes = await pool.query(
    'SELECT id, name, status FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
    [projectId, tenantId]
  );
  if (currentRes.rows.length === 0) {
    const err = new Error('PROJECT_NOT_FOUND');
    err.status = 404;
    throw err;
  }
  const project = currentRes.rows[0];

  if (project.status !== 'active') {
    const err = new Error('PROJECT_NOT_ACTIVE');
    err.message = 'Only active projects can be paused.';
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update project status and hold columns
    const updateRes = await client.query(
      `UPDATE projects 
       SET status = 'on_hold',
           on_hold_reason = $1,
           expected_resume_date = $2,
           paused_at = NOW(),
           paused_by = $3,
           updated_at = NOW()
       WHERE id = $4 AND tenant_id = $5
       RETURNING *`,
      [reason, expectedResumeDate || null, userId, projectId, tenantId]
    );
    const updatedProject = updateRes.rows[0];

    // 2. Resource Reallocation Trigger: Deactivate all project site team members
    await client.query(
      `UPDATE project_site_team
       SET status = 'inactive',
           updated_at = NOW()
       WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, tenantId]
    );

    // 3. Save Client Communication Record if provided
    if (clientCommunication) {
      await client.query(
        `INSERT INTO communications (tenant_id, project_id, user_id, channel, direction, subject, body, sent_at)
         VALUES ($1, $2, $3, $4, $5, $6, $7, NOW())`,
        [
          tenantId,
          projectId,
          userId,
          clientCommunication.channel,
          clientCommunication.direction || 'outbound',
          clientCommunication.subject || 'Project Pause Notification',
          clientCommunication.body
        ]
      );
    }

    // 4. Log audit action
    await logAction({
      tenantId,
      userId,
      action: 'project.paused',
      entity: 'project',
      entityId: projectId,
      oldValue: { status: project.status },
      newValue: { status: 'on_hold', reason, expectedResumeDate }
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

/**
 * Resumes a paused project, setting status to 'active', logging audit trails.
 */
async function resumeProject({ projectId, tenantId, userId }) {
  const currentRes = await pool.query(
    'SELECT id, name, status FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
    [projectId, tenantId]
  );
  if (currentRes.rows.length === 0) {
    const err = new Error('PROJECT_NOT_FOUND');
    err.status = 404;
    throw err;
  }
  const project = currentRes.rows[0];

  if (project.status !== 'on_hold') {
    const err = new Error('PROJECT_NOT_PAUSED');
    err.message = 'Only paused projects can be resumed.';
    err.status = 400;
    throw err;
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Update project status and clear hold columns
    const updateRes = await client.query(
      `UPDATE projects 
       SET status = 'active',
           expected_resume_date = NULL,
           updated_at = NOW()
       WHERE id = $1 AND tenant_id = $2
       RETURNING *`,
      [projectId, tenantId]
    );
    const updatedProject = updateRes.rows[0];

    // 2. Log audit action
    await logAction({
      tenantId,
      userId,
      action: 'project.resumed',
      entity: 'project',
      entityId: projectId,
      oldValue: { status: project.status },
      newValue: { status: 'active' }
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

module.exports = { pauseProject, resumeProject };
