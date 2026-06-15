const { S3Client, GetObjectCommand, PutObjectCommand } = require('@aws-sdk/client-s3');
const { getSignedUrl } = require('@aws-sdk/s3-request-presigner');
const pool = require('../../config/db');

// Ensure the S3 Client initializes safely by falling back if env vars are missing locally.
const s3Client = new S3Client({
  region: process.env.AWS_REGION || 'us-east-1',
  credentials: {
    accessKeyId: process.env.AWS_ACCESS_KEY_ID || 'mock_access_key',
    secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || 'mock_secret_key'
  }
});
const BUCKET_NAME = process.env.AWS_S3_BUCKET_NAME || 'crm-documents-bucket';

async function getUploadUrl({ tenantId, projectId, phaseId, name, mimeType, docType }) {
  // Sanitize file name explicitly to avoid special character injection routing issues
  const safeName = name.replace(/[^a-zA-Z0-9.-]/g, '_');
  const storageKey = `${tenantId}/projects/${projectId}/docs/${Date.now()}-${safeName}`;

  const command = new PutObjectCommand({
    Bucket: BUCKET_NAME,
    Key: storageKey,
    ContentType: mimeType
  });

  // Create a 5-minute pre-signed window for the frontend to pipe the file directly to S3
  const uploadUrl = await getSignedUrl(s3Client, command, { expiresIn: 300 });

  return { uploadUrl, storageKey };
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
  const command = new GetObjectCommand({
    Bucket: BUCKET_NAME,
    Key: storageKey
  });

  // Generate a secure 1-hour access URL for downloading/viewing the document
  const url = await getSignedUrl(s3Client, command, { expiresIn: 3600 });
  return url;
}

module.exports = {
  getUploadUrl,
  registerDocument,
  getDocumentUrl
};
