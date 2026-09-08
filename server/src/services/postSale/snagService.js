const logger = require('../../utils/logger');
const pool = require('../../db/pool');
const { logAction } = require('../auditLog');
const { dispatchEvent } = require('../webhooks/webhookDispatcher');
const { notifyUser } = require('../notificationService');

async function createSnag({ tenantId, projectId, raisedBy, raisedByClient, title, description, photoKeys, category, rootCauseCategory, vendorId }) {
  let targetTenantId = tenantId;
  if (projectId) {
    try {
      const projRes = await pool.query('SELECT tenant_id FROM projects WHERE id = $1', [projectId]);
      if (projRes.rows.length > 0 && projRes.rows[0].tenant_id) {
        targetTenantId = projRes.rows[0].tenant_id;
      }
    } catch (e) {
      console.warn('Could not resolve project tenantId', e.message);
    }
  }

  const result = await pool.query(
    `INSERT INTO snags (tenant_id, project_id, raised_by, raised_by_client, title, description, photo_keys, category, status, root_cause_category, vendor_id)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'open', $9, $10)
     RETURNING *`,
    [targetTenantId, projectId, raisedBy, raisedByClient, title, description, JSON.stringify(photoKeys || []), category, rootCauseCategory || null, vendorId || null]
  );
  
  const snag = result.rows[0];

  if (raisedByClient) {
    dispatchEvent(targetTenantId, 'client.snag_raised', {
      snagId: snag.id,
      projectId,
      title
    });

    const projRes = await pool.query('SELECT pm_id FROM projects WHERE id=$1', [projectId]);
    if (projRes.rows.length > 0 && projRes.rows[0].pm_id) {
      notifyUser({
        tenantId: targetTenantId,
        userId: projRes.rows[0].pm_id,
        type: 'snag.raised_by_client',
        message: `Client raised snag: '${title}'`,
        referenceUrl: `/projects/${projectId}/snags`,
      });
    }
  }

  return snag;
}

async function assignSnag({ tenantId, snagId, assigneeId, userId }) {
  const result = await pool.query(
    `UPDATE snags
     SET status = 'assigned', assignee_id = $3
     WHERE (tenant_id = $1 OR tenant_id IS NULL) AND id = $2
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

async function updateSnagStatus({ 
  tenantId, 
  snagId, 
  status, 
  assigneeId,
  resolutionNote, 
  userId,
  reworkRequired,
  reworkRootCauseCategory,
  reworkEstimatedHours,
  reworkActualHours,
  reworkCost,
  rootCauseCategory,
  vendorId
}) {
  const snagResult = await pool.query(
    `SELECT * FROM snags WHERE (tenant_id = $1 OR tenant_id IS NULL) AND id = $2`,
    [tenantId, snagId]
  );
  const snag = snagResult.rows[0];
  if (!snag) throw new Error('Snag not found');

  const validTransitions = {
    'open': ['assigned', 'in_progress', 'resolved'],
    'assigned': ['open', 'in_progress', 'resolved'],
    'in_progress': ['open', 'assigned', 'resolved'],
    'resolved': ['open', 'assigned', 'in_progress', 'client_verified'],
    'client_verified': ['open', 'assigned', 'in_progress', 'resolved']
  };

  if (status && status !== snag.status) {
    if (!validTransitions[snag.status] || !validTransitions[snag.status].includes(status)) {
      throw new Error(`Invalid status transition from ${snag.status} to ${status}`);
    }
  }

  let updateQuery = `UPDATE snags SET`;
  const params = [tenantId, snagId];
  let index = 3;
  let setClauses = [];
  
  if (status) {
    setClauses.push(`status = $${index++}`);
    params.push(status);
  }

  if (status === 'resolved') {
    setClauses.push(`resolved_at = NOW()`);
    setClauses.push(`resolution_note = $${index++}`);
    params.push(resolutionNote);
  }

  if (reworkRequired !== undefined) {
    setClauses.push(`rework_required = $${index++}`);
    params.push(reworkRequired);
  }
  if (reworkRootCauseCategory !== undefined) {
    setClauses.push(`rework_root_cause_category = $${index++}`);
    params.push(reworkRootCauseCategory);
  }
  if (reworkEstimatedHours !== undefined) {
    setClauses.push(`rework_estimated_hours = $${index++}`);
    params.push(reworkEstimatedHours);
  }
  if (reworkActualHours !== undefined) {
    setClauses.push(`rework_actual_hours = $${index++}`);
    params.push(reworkActualHours);
  }
  if (reworkCost !== undefined) {
    setClauses.push(`rework_cost = $${index++}`);
    params.push(reworkCost);
  }
  if (status === 'resolved' && (reworkRequired || snag.rework_required)) {
    setClauses.push(`rework_completed_at = NOW()`);
  }

  if (rootCauseCategory !== undefined) {
    setClauses.push(`root_cause_category = $${index++}`);
    params.push(rootCauseCategory);
  }
  if (vendorId !== undefined) {
    setClauses.push(`vendor_id = $${index++}`);
    params.push(vendorId && vendorId !== '' ? vendorId : null);
  }
  if (assigneeId !== undefined) {
    setClauses.push(`assignee_id = $${index++}`);
    params.push(assigneeId && assigneeId !== '' ? assigneeId : null);
  }

  if (setClauses.length === 0) {
    return snag;
  }

  updateQuery += ` ${setClauses.join(', ')} WHERE (tenant_id = $1 OR tenant_id IS NULL) AND id = $2 RETURNING *`;
  
  const result = await pool.query(updateQuery, params);
  const updatedSnag = result.rows[0];

  await logAction({
    tenantId,
    userId,
    action: 'update_snag_status',
    entity: 'snag',
    entityId: snagId,
    newValue: { status, resolutionNote, reworkRequired }
  });

  if (status === 'resolved') {
    setImmediate(async () => {
      try {
        const { checkAndNotifyHandoverReadiness } = require('./handoverService');
        await checkAndNotifyHandoverReadiness(tenantId, snag.project_id);
      } catch (error) {
        logger.error('[Snag Service] Error checking handover readiness on resolution:', error.message);
      }
    });
  }

  if (status) {
    dispatchEvent(tenantId, 'snag.status_changed', {
      snagId,
      projectId: snag.project_id,
      oldStatus: snag.status,
      newStatus: status
    });
  }

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
     WHERE (tenant_id = $1 OR tenant_id IS NULL) AND id = $2
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

  setImmediate(async () => {
    try {
      const { checkAndNotifyHandoverReadiness } = require('./handoverService');
      await checkAndNotifyHandoverReadiness(tenantId, snag.project_id);
    } catch (error) {
      logger.error('[Snag Service] Error checking handover readiness on verification:', error.message);
    }
  });

  return snag;
}

async function getSnags({ tenantId, projectId, status, assigneeId, category, page = 1, limit = 50 }) {
  const offset = (page - 1) * limit;
  const params = [];
  let query = `
    SELECT s.*, 
           u.name as assignee_name, 
           creator.name as raised_by_name,
           pv.vendor_name
    FROM snags s
    LEFT JOIN users u ON s.assignee_id = u.id
    LEFT JOIN users creator ON s.raised_by = creator.id
    LEFT JOIN project_vendors pv ON s.vendor_id = pv.id
    WHERE 1=1
  `;
  
  if (projectId) {
    params.push(projectId);
    query += ` AND s.project_id = $${params.length}`;
  } else if (tenantId) {
    params.push(tenantId);
    query += ` AND (s.tenant_id = $${params.length} OR s.tenant_id IS NULL)`;
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

async function deleteSnag({ tenantId, snagId, userId }) {
  const result = await pool.query(
    `DELETE FROM snags WHERE (tenant_id = $1 OR tenant_id IS NULL) AND id = $2 RETURNING *`,
    [tenantId, snagId]
  );
  const snag = result.rows[0];
  if (!snag) throw new Error('Snag not found');

  await logAction({
    tenantId,
    userId,
    action: 'delete_snag',
    entity: 'snag',
    entityId: snagId
  });

  return snag;
}

module.exports = {
  createSnag,
  assignSnag,
  updateSnagStatus,
  clientVerifySnag,
  getSnags,
  deleteSnag
};
