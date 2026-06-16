const pool = require('../../config/db');
const { dispatchEvent } = require('../webhooks/webhookDispatcher');
const { notifyUser } = require('../notificationService');

async function addVersion(tenantId, originalDocId, { storageKey, uploadedBy, fileSize, mimeType }) {
  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Fetch original document safely
    const { rows: origRows } = await client.query(
      'SELECT * FROM documents WHERE id = $1 AND tenant_id = $2 FOR UPDATE',
      [originalDocId, tenantId]
    );

    if (origRows.length === 0) {
      const err = new Error('NOT_FOUND');
      err.status = 404;
      throw err;
    }

    const orig = origRows[0];

    // 2. Archive original record as superseded
    await client.query(
      "UPDATE documents SET status = 'superseded' WHERE id = $1 AND tenant_id = $2",
      [originalDocId, tenantId]
    );

    // 3. Inject identical document metadata but iterate the version count and stamp the new S3 key
    const insertQuery = `
      INSERT INTO documents (
        tenant_id, project_id, phase_id, task_id, name, doc_type,
        version, storage_key, file_size_bytes, mime_type, uploaded_by, status, is_visible_to_client
      ) VALUES (
        $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, 'pending_review', $12
      ) RETURNING *
    `;

    const values = [
      tenantId, orig.project_id, orig.phase_id, orig.task_id, orig.name, orig.doc_type,
      orig.version + 1, storageKey, fileSize || null, mimeType || null, uploadedBy || null, orig.is_visible_to_client
    ];

    const { rows: newRows } = await client.query(insertQuery, values);

    await client.query('COMMIT');
    return newRows[0];
  } catch (e) {
    await client.query('ROLLBACK');
    throw e;
  } finally {
    client.release();
  }
}

async function approveDocument(tenantId, docId, userId) {
  const { rows } = await pool.query(`
    UPDATE documents 
    SET status = 'approved', approved_by = $1, approved_at = NOW()
    WHERE id = $2 AND tenant_id = $3
    RETURNING *
  `, [userId, docId, tenantId]);

  if (rows.length === 0) {
    const err = new Error('NOT_FOUND');
    err.status = 404;
    throw err;
  }
  
  const doc = rows[0];

  // Silently dispatch non-blocking webhook confirming approval to third-party integrations
  dispatchEvent(tenantId, 'client.design_approved', {
    docId: doc.id,
    projectId: doc.project_id,
    name: doc.name,
    version: doc.version,
    docType: doc.doc_type
  }).catch(e => console.error('[Webhook Error] client.design_approved:', e));

  if (doc.uploaded_by) {
    notifyUser({
      tenantId,
      userId: doc.uploaded_by,
      type: 'document.approved',
      message: `Client approved: '${doc.name}'`,
      referenceUrl: `/projects/${doc.project_id}`,
    });
  }

  return doc;
}

async function requestRevision(tenantId, docId, note, _userId) {
  const { rows } = await pool.query(`
    UPDATE documents 
    SET status = 'revision_requested', revision_note = $1
    WHERE id = $2 AND tenant_id = $3
    RETURNING *
  `, [note, docId, tenantId]);

  if (rows.length === 0) {
    const err = new Error('NOT_FOUND');
    err.status = 404;
    throw err;
  }
  
  return rows[0];
}

module.exports = {
  addVersion,
  approveDocument,
  requestRevision
};
