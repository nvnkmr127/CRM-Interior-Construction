const pool = require('../../db/pool');
const { logAction } = require('../auditLog');
const { dispatchEvent } = require('../webhooks/webhookDispatcher');

async function createSnag({ tenantId, projectId, raisedBy, raisedByClient, title, description, photoKeys, category }) {
  const result = await pool.query(
    `INSERT INTO snags (tenant_id, project_id, raised_by, raised_by_client, title, description, photo_keys, category, status)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open')
     RETURNING *`,
    [tenantId, projectId, raisedBy, raisedByClient, title, description, JSON.stringify(photoKeys || []), category]
  );
  
  const snag = result.rows[0];

  if (raisedByClient) {
    dispatchEvent(tenantId, 'client.snag_raised', {
      snagId: snag.id,
      projectId,
      title
    });
  }

  return snag;
}

async function assignSnag({ tenantId, snagId, assigneeId, userId }) {
  const result = await pool.query(
    `UPDATE snags
     SET status = 'assigned', assignee_id = $3
     WHERE tenant_id = $1 AND id = $2
     RETURNING *`,
    [tenantId, snagId, assigneeId]
  );

  const snag = result.rows[0];
  if (!snag) throw new Error('Snag not found');

  await logAction({
    tenantId,
    userId,
    action: 'assign_snag',
    entity: 'snag',
    entityId: snagId,
    newValue: { assigneeId, status: 'assigned' }
  });

  return snag;
}

async function updateSnagStatus({ tenantId, snagId, status, resolutionNote, userId }) {
  // get current snag to check valid transitions and SLA
  const snagResult = await pool.query(
    `SELECT * FROM snags WHERE tenant_id = $1 AND id = $2`,
    [tenantId, snagId]
  );
  const snag = snagResult.rows[0];
  if (!snag) throw new Error('Snag not found');

  const validTransitions = {
    'open': ['assigned'],
    'assigned': ['in_progress'],
    'in_progress': ['resolved']
  };

  if (!validTransitions[snag.status] || !validTransitions[snag.status].includes(status)) {
    throw new Error(`Invalid status transition from ${snag.status} to ${status}`);
  }

  let updateQuery = `UPDATE snags SET status = $3`;
  const params = [tenantId, snagId, status];
  
  if (status === 'resolved') {
    updateQuery += `, resolved_at = NOW(), resolution_note = $4`;
    params.push(resolutionNote);
  }

  updateQuery += ` WHERE tenant_id = $1 AND id = $2 RETURNING *`;
  
  const result = await pool.query(updateQuery, params);
  const updatedSnag = result.rows[0];

  await logAction({
    tenantId,
    userId,
    action: 'update_snag_status',
    entity: 'snag',
    entityId: snagId,
    newValue: { status, resolutionNote }
  });

  dispatchEvent(tenantId, 'snag.status_changed', {
    snagId,
    projectId: snag.project_id,
    oldStatus: snag.status,
    newStatus: status
  });

  if (status === 'resolved' && snag.created_at) {
    const hoursTaken = (new Date() - new Date(snag.created_at)) / (1000 * 60 * 60);
    const slaHours = snag.sla_hours || 48;
    if (hoursTaken > slaHours) {
      await logAction({
        tenantId,
        userId,
        action: 'snag.sla_breached',
        entity: 'snag',
        entityId: snagId,
        newValue: { hoursTaken, slaHours }
      });
    }
  }

  return updatedSnag;
}

async function clientVerifySnag({ tenantId, snagId, clientPortalUserId }) {
  const result = await pool.query(
    `UPDATE snags
     SET status = 'client_verified', client_verified_at = NOW()
     WHERE tenant_id = $1 AND id = $2
     RETURNING *`,
    [tenantId, snagId]
  );
  
  const snag = result.rows[0];
  if (!snag) throw new Error('Snag not found');
  
  await logAction({
    tenantId,
    userId: clientPortalUserId,
    action: 'client_verify_snag',
    entity: 'snag',
    entityId: snagId,
    newValue: { status: 'client_verified' }
  });

  return snag;
}

async function getSnags({ tenantId, projectId, status, assigneeId, category, page = 1, limit = 10 }) {
  const offset = (page - 1) * limit;
  const params = [tenantId];
  let query = `
    SELECT s.*, u.name as assignee_name
    FROM snags s
    LEFT JOIN users u ON s.assignee_id = u.id
    WHERE s.tenant_id = $1
  `;
  
  if (projectId) {
    params.push(projectId);
    query += ` AND s.project_id = $${params.length}`;
  }
  
  if (status) {
    params.push(status);
    query += ` AND s.status = $${params.length}`;
  }

  if (assigneeId) {
    params.push(assigneeId);
    query += ` AND s.assignee_id = $${params.length}`;
  }

  if (category) {
    params.push(category);
    query += ` AND s.category = $${params.length}`;
  }
  
  query += ` ORDER BY s.created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  
  const result = await pool.query(query, [...params, limit, offset]);
  return result.rows;
}

module.exports = {
  createSnag,
  assignSnag,
  updateSnagStatus,
  clientVerifySnag,
  getSnags
};
