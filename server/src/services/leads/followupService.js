/* eslint-disable no-unused-vars */
const pool = require('../../db/pool');
const eventBus = require('../../utils/eventBus');

async function getFollowups({ tenantId, leadId }) {
  const result = await pool.query(
    `SELECT f.*, u.name AS assignee_name FROM lead_followups f
     LEFT JOIN users u ON f.assignee_id = u.id
     WHERE f.tenant_id = $1 AND f.lead_id = $2
     ORDER BY f.due_at ASC`,
    [tenantId, leadId]
  );
  return result.rows;
}

async function createFollowup({ tenantId, userId, leadId, title, due_at, assignee_id, notes }) {
  if (!title || !due_at) {
    const error = new Error('title and due_at required');
    error.code = 'VALIDATION_ERROR';
    error.statusCode = 400;
    throw error;
  }

  const result = await pool.query(
    `INSERT INTO lead_followups (tenant_id, lead_id, created_by, assignee_id, title, due_at, notes)
     VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
    [tenantId, leadId, userId, assignee_id || userId, title, due_at, notes || null]
  );

  const formattedDate = new Date(due_at).toLocaleDateString();
  // Emit event for decoupled tracking
  eventBus.emit('lead.followup_scheduled', {
    tenantId,
    userId,
    leadId,
    followupId: result.rows[0].id,
    title,
    formattedDate
  });

  return result.rows[0];
}

async function updateFollowup({ tenantId, userId, leadId, fid, is_done, title, due_at, notes }) {
  // Get old status to check if is_done changed
  const oldRes = await pool.query('SELECT title, is_done FROM lead_followups WHERE id = $1 AND lead_id = $2 AND tenant_id = $3', [fid, leadId, tenantId]);
  const oldFollowup = oldRes.rows[0];

  const result = await pool.query(
    `UPDATE lead_followups SET
      is_done = COALESCE($1, is_done),
      done_at = CASE WHEN $1 = true THEN NOW() ELSE done_at END,
      title = COALESCE($2, title),
      due_at = COALESCE($3, due_at),
      notes = COALESCE($4, notes)
     WHERE id = $5 AND lead_id = $6 AND tenant_id = $7
     RETURNING *`,
    [is_done ?? null, title || null, due_at || null, notes || null, fid, leadId, tenantId]
  );
  
  if (!result.rows[0]) {
    const error = new Error('Follow-up not found');
    error.code = 'NOT_FOUND';
    error.statusCode = 404;
    throw error;
  }

  const newFollowup = result.rows[0];
  let eventName = 'lead.followup_updated';
  if (oldFollowup && oldFollowup.is_done !== newFollowup.is_done) {
    eventName = newFollowup.is_done 
      ? 'lead.followup_completed' 
      : 'lead.followup_reverted';
  }

  // Emit event for decoupled tracking
  eventBus.emit(eventName, {
    tenantId,
    userId,
    leadId,
    followupId: fid,
    title: newFollowup.title
  });

  return newFollowup;
}

async function deleteFollowup({ tenantId, userId, leadId, fid }) {
  const oldRes = await pool.query('SELECT title FROM lead_followups WHERE id = $1 AND lead_id = $2 AND tenant_id = $3', [fid, leadId, tenantId]);
  const title = oldRes.rows[0]?.title || 'Follow-up';

  await pool.query(
    'DELETE FROM lead_followups WHERE id = $1 AND lead_id = $2 AND tenant_id = $3',
    [fid, leadId, tenantId]
  );

  // Emit event for decoupled tracking
  eventBus.emit('lead.followup_cancelled', {
    tenantId,
    userId,
    leadId,
    followupId: fid,
    title
  });

  return true;
}

module.exports = {
  getFollowups,
  createFollowup,
  updateFollowup,
  deleteFollowup
};
