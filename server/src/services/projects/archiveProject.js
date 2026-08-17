const pool = require('../../config/db');
const { logAction } = require('../auditLog');

/**
 * Formally archive a project.
 */
async function archiveProject({ projectId, tenantId, userId, reason }) {
  // Fetch current project
  const currentRes = await pool.query(
    'SELECT id, name, status FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
    [projectId, tenantId]
  );
  if (currentRes.rows.length === 0) {
    const error = new Error('PROJECT_NOT_FOUND');
    error.status = 404;
    throw error;
  }
  const project = currentRes.rows[0];

  if (project.status === 'archived') {
    return project;
  }

  // Update status to archived
  const updateRes = await pool.query(
    `UPDATE projects 
     SET status = 'archived', 
         archive_reason = $1, 
         archived_at = NOW(), 
         archived_by = $2, 
         updated_at = NOW() 
     WHERE id = $3 AND tenant_id = $4 AND deleted_at IS NULL
     RETURNING *`,
    [reason || null, userId, projectId, tenantId]
  );
  const updatedProject = updateRes.rows[0];

  // Log audit action
  await logAction({
    tenantId,
    userId,
    action: 'project.archived',
    entity: 'project',
    entityId: projectId,
    oldValue: { status: project.status },
    newValue: { status: 'archived', reason }
  });

  return updatedProject;
}

module.exports = { archiveProject };
