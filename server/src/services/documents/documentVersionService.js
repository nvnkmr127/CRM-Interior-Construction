const pool = require('../../config/db');

/**
 * Approve a document under strict tenant scoping
 */
async function approveDocument(tenantId, docId, userId = null) {
  const query = `
    UPDATE documents
    SET status = 'approved',
        approved_by = $3,
        approved_at = CURRENT_TIMESTAMP
    WHERE id = $1 AND tenant_id = $2
    RETURNING *
  `;
  const { rows } = await pool.query(query, [docId, tenantId, userId]);
  if (rows.length === 0) {
    const error = new Error('NOT_FOUND');
    error.status = 404;
    throw error;
  }
  return rows[0];
}

/**
 * Request revision for a document under strict tenant scoping
 */
async function requestRevision(tenantId, docId, note, _userId = null) {
  const query = `
    UPDATE documents
    SET status = 'revision_requested',
        revision_note = $3
    WHERE id = $1 AND tenant_id = $2
    RETURNING *
  `;
  const { rows } = await pool.query(query, [docId, tenantId, note]);
  if (rows.length === 0) {
    const error = new Error('NOT_FOUND');
    error.status = 404;
    throw error;
  }
  return rows[0];
}

/**
 * Update document version / storage key under strict tenant scoping
 */
async function addVersion(tenantId, docId, { storageKey, uploadedBy = null, fileSize = null, mimeType = null }) {
  const query = `
    UPDATE documents
    SET storage_key = $3,
        file_size_bytes = COALESCE($4, file_size_bytes),
        mime_type = COALESCE($5, mime_type),
        uploaded_by = COALESCE($6, uploaded_by),
        status = 'pending_review',
        revision_note = NULL,
        approved_by = NULL,
        approved_at = NULL
    WHERE id = $1 AND tenant_id = $2
    RETURNING *
  `;
  const { rows } = await pool.query(query, [
    docId,
    tenantId,
    storageKey,
    fileSize,
    mimeType,
    uploadedBy
  ]);

  if (rows.length === 0) {
    const error = new Error('NOT_FOUND');
    error.status = 404;
    throw error;
  }
  return rows[0];
}

module.exports = {
  approveDocument,
  requestRevision,
  addVersion
};
