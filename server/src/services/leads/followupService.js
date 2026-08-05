/* eslint-disable no-unused-vars */
const pool = require('../../db/pool');

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
  return result.rows[0];
}

async function updateFollowup({ tenantId, leadId, fid, is_done, title, due_at, notes }) {
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
  return result.rows[0];
}

async function deleteFollowup({ tenantId, leadId, fid }) {
  const result = await pool.query(
    'DELETE FROM lead_followups WHERE id = $1 AND lead_id = $2 AND tenant_id = $3',
    [fid, leadId, tenantId]
  );
  return true;
}

module.exports = {
  getFollowups,
  createFollowup,
  updateFollowup,
  deleteFollowup
};
