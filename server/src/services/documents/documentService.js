const storage = require('../../utils/storage');
const pool = require('../../config/db');

async function getUploadUrl({ tenantId, projectId, _phaseId, name, mimeType, _docType }) {
  // Sanitize file name explicitly to avoid special character injection routing issues
  const safeName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storageKey = `${tenantId}/projects/${projectId}/docs/${Date.now()}-${safeName}`;

  const { uploadUrl, storageKey: finalKey } = await storage.getUploadUrl(storageKey, mimeType);

  return { uploadUrl, storageKey: finalKey };
}

async function registerDocument({ 
  tenantId, projectId, phaseId, taskId, name, docType, 
  storageKey, fileSize, mimeType, uploadedBy 
}) {
  const query = `
    INSERT INTO documents (
      tenant_id, project_id, phase_id, task_id, name, doc_type,
      storage_key, file_size_bytes, mime_type, uploaded_by, status
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11
    ) RETURNING *
  `;
  const values = [
    tenantId, projectId, phaseId || null, taskId || null, name, docType || null,
    storageKey, fileSize || null, mimeType || null, uploadedBy || null, 'pending_review'
  ];

  const { rows } = await pool.query(query, values);
  return rows[0];
}

async function getDocumentUrl(storageKey) {
  return await storage.getDownloadUrl(storageKey);
}

module.exports = {
  getUploadUrl,
  registerDocument,
  getDocumentUrl
};
