const pool = require('../../config/db');
const { logAction } = require('../auditLog');
const { notifyUser } = require('../notificationService');

async function replaceResource({ tenantId, userId, projectId, role, newResourceId, handoverNotes }) {
  // Validate role
  if (role !== 'pm' && role !== 'designer') {
    const error = new Error('INVALID_ROLE');
    error.message = 'Role must be either pm or designer';
    error.status = 400;
    throw error;
  }

  const client = await pool.connect();

  try {
    await client.query('BEGIN');

    // 1. Fetch current project and validate existence
    const projectRes = await client.query(
      'SELECT id, name, pm_id, designer_id, client_name, client_email FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [projectId, tenantId]
    );
    if (projectRes.rows.length === 0) {
      const error = new Error('NOT_FOUND');
      error.message = 'Project not found';
      error.status = 404;
      throw error;
    }

    const project = projectRes.rows[0];
    const oldResourceId = role === 'pm' ? project.pm_id : project.designer_id;

    if (!oldResourceId) {
      const error = new Error('NO_CURRENT_ASSIGNMENT');
      error.message = `Cannot replace resource: no user is currently assigned to this project as ${role.toUpperCase()}.`;
      error.status = 400;
      throw error;
    }

    if (oldResourceId === newResourceId) {
      const error = new Error('SAME_RESOURCE');
      error.message = 'New resource is already assigned to this project.';
      error.status = 400;
      throw error;
    }

    // 2. Fetch new resource user info and check existence
    const newUserRes = await client.query(
      'SELECT id, name, email FROM users WHERE id = $1 AND tenant_id = $2 AND status = $3',
      [newResourceId, tenantId, 'active']
    );
    if (newUserRes.rows.length === 0) {
      const error = new Error('NEW_RESOURCE_NOT_FOUND');
      error.message = 'New resource user not found or is inactive';
      error.status = 400;
      throw error;
    }
    const newUser = newUserRes.rows[0];

    // Fetch old resource user info
    const oldUserRes = await client.query(
      'SELECT name FROM users WHERE id = $1 AND tenant_id = $2',
      [oldResourceId, tenantId]
    );
    const oldUser = oldUserRes.rows[0];
    const oldUserName = oldUser ? oldUser.name : 'Unknown User';

    // Fetch creator user info
    const creatorUserRes = await client.query(
      'SELECT name FROM users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );
    const creatorUser = creatorUserRes.rows[0];
    const creatorUserName = creatorUser ? creatorUser.name : 'System';

    // 3. Update the projects table pm_id or designer_id
    const updateColumn = role === 'pm' ? 'pm_id' : 'designer_id';
    await client.query(
      `UPDATE projects SET ${updateColumn} = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3`,
      [newResourceId, projectId, tenantId]
    );

    // 4. Create the handover history entry
    const insertRes = await client.query(
      `INSERT INTO project_resource_handovers (
        tenant_id, project_id, role, replaced_user_id, assigned_user_id, handover_notes, created_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenantId, projectId, role, oldResourceId, newResourceId, handoverNotes, userId]
    );
    const handover = insertRes.rows[0];

    // 5. Add audit log record
    await logAction({
      tenantId,
      userId,
      action: 'project.resource_replaced',
      entity: 'project',
      entityId: projectId,
      oldValue: {
        role,
        userId: oldResourceId,
        userName: oldUserName
      },
      newValue: {
        role,
        userId: newResourceId,
        userName: newUser.name,
        handoverId: handover.id
      }
    }, client);

    // 6. Notify incoming team member
    notifyUser({
      tenantId,
      userId: newResourceId,
      type: 'assignment',
      message: `You have been assigned as the new ${role.toUpperCase()} for project "${project.name}". Outgoing: ${oldUserName}. Handover: "${handoverNotes.substring(0, 100)}..."`,
      referenceUrl: `/projects/${projectId}?tab=Handovers`,
      actorId: userId,
      actorName: creatorUserName
    });

    // 7. Client Notification Simulation (Stub log)
    const clientName = project.client_name || 'Client';
    const clientEmail = project.client_email || 'client@example.com';
    console.log(
      `[Client Notification Stub] Mid-project resource replacement alert sent to ${clientName} (${clientEmail}). ` +
      `New Point of Contact for ${role.toUpperCase()}: ${newUser.name}.`
    );

    await client.query('COMMIT');
    return handover;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { replaceResource };
