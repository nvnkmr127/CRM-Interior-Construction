const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const pool = require('../config/db');
const { getUploadUrl, registerDocument, getDocumentUrl } = require('../services/documents/documentService');
const { addVersion, approveDocument, requestRevision } = require('../services/documents/documentVersionService');

// MergeParams essential for extracting :projectId dynamically
const router = express.Router({ mergeParams: true });
router.use(authenticate);

const uploadUrlSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  mimeType: z.string().min(1, 'Mime type is required'),
  docType: z.string().optional(),
  phaseId: z.string().uuid().optional().nullable()
});

const registerSchema = z.object({
  storageKey: z.string().min(1, 'Storage key is required'),
  name: z.string().min(1, 'Name is required'),
  docType: z.string().optional(),
  phaseId: z.string().uuid().optional().nullable(),
  taskId: z.string().uuid().optional().nullable(),
  fileSize: z.number().optional().nullable(),
  mimeType: z.string().optional()
});

const revisionSchema = z.object({
  note: z.string().min(1, 'Revision note cannot be empty')
});

const versionSchema = z.object({
  storageKey: z.string().min(1, 'Storage key is required'),
  fileSize: z.number().optional().nullable(),
  mimeType: z.string().optional()
});

// GET /api/projects/:projectId/documents
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const { phaseId, docType } = req.query;
    let query = `SELECT * FROM documents WHERE project_id = $1 AND tenant_id = $2`;
    const values = [req.params.projectId, req.tenantId];
    let idx = 3;

    if (phaseId) {
      query += ` AND phase_id = $${idx++}`;
      values.push(phaseId);
    }
    if (docType) {
      query += ` AND doc_type = $${idx++}`;
      values.push(docType);
    }

    query += ` ORDER BY created_at DESC`;

    const { rows } = await pool.query(query, values);
    return success(res, rows);
  } catch (err) {
    console.error('[Documents Router] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch documents.', 500);
  }
});

// POST /api/projects/:projectId/documents/upload-url
router.post('/upload-url', authorize('projects:manage'), async (req, res, next) => {
  try {
    const data = uploadUrlSchema.parse(req.body);
    const result = await getUploadUrl({
      tenantId: req.tenantId,
      projectId: req.params.projectId,
      phaseId: data.phaseId,
      name: data.name,
      mimeType: data.mimeType,
      docType: data.docType
    });
    return success(res, result);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[Documents Router] upload-url error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to generate AWS upload URL.', 500);
  }
});

// POST /api/projects/:projectId/documents/register
router.post('/register', authorize('projects:manage'), async (req, res, next) => {
  try {
    const data = registerSchema.parse(req.body);

    // V2 Security: Validate File Magic Number against claimed MimeType
    const storage = require('../utils/storage');
    if (data.mimeType) {
      const isValid = await storage.validateMagicNumber(data.storageKey, data.mimeType);
      if (!isValid) {
        // If invalid, delete the malicious file and reject the registration
        await storage.deleteFile(data.storageKey).catch(e => console.error(e));
        return fail(res, 'SECURITY_REJECTED', 'Malware scan failed: File signature does not match claimed MIME type.', 403);
      }
    }

    const doc = await registerDocument({
      tenantId: req.tenantId,
      projectId: req.params.projectId,
      phaseId: data.phaseId,
      taskId: data.taskId,
      name: data.name,
      docType: data.docType,
      storageKey: data.storageKey,
      fileSize: data.fileSize,
      mimeType: data.mimeType,
      uploadedBy: req.user.userId
    });
    return success(res, doc, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[Documents Router] register error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to register document in database.', 500);
  }
});

// GET /api/projects/:projectId/documents/:did/url
router.get('/:did/url', authorize('projects:read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT storage_key FROM documents WHERE id = $1 AND tenant_id = $2',
      [req.params.did, req.tenantId]
    );
    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Document not found.', 404);

    const url = await getDocumentUrl(rows[0].storage_key);
    return success(res, { url });
  } catch (err) {
    console.error('[Documents Router] get URL error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to generate secure AWS access URL.', 500);
  }
});

// POST /api/projects/:projectId/documents/:did/approve
router.post('/:did/approve', authorize('projects:manage'), async (req, res, next) => {
  try {
    const docRes = await pool.query(
      'SELECT doc_type FROM documents WHERE id = $1 AND tenant_id = $2',
      [req.params.did, req.tenantId]
    );
    if (docRes.rows.length === 0) return fail(res, 'NOT_FOUND', 'Document not found.', 404);
    const doc = docRes.rows[0];

    if ((doc.doc_type === 'drawing' || doc.doc_type === 'render') && req.user?.role !== 'superadmin') {
      const perms = req.user?.permissions || [];
      if (!perms.includes('design:approve')) {
        return fail(res, 'FORBIDDEN', 'Forbidden: only designers with design:approve permission can approve design documents.', 403);
      }
    }

    const approvedDoc = await approveDocument(req.tenantId, req.params.did, req.user.userId);
    return success(res, approvedDoc);
  } catch (err) {
    if (err.message === 'NOT_FOUND' || err.status === 404) return fail(res, 'NOT_FOUND', 'Document not found.', 404);
    console.error('[Documents Router] approve error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to approve document.', 500);
  }
});

// POST /api/projects/:projectId/documents/:did/revision
router.post('/:did/revision', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { note } = revisionSchema.parse(req.body);
    const doc = await requestRevision(req.tenantId, req.params.did, note, req.user.userId);
    return success(res, doc);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    if (err.message === 'NOT_FOUND' || err.status === 404) return fail(res, 'NOT_FOUND', 'Document not found.', 404);
    console.error('[Documents Router] revision error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to process revision request.', 500);
  }
});

// POST /api/projects/:projectId/documents/:did/version
router.post('/:did/version', authorize('projects:manage'), async (req, res, next) => {
  try {
    const data = versionSchema.parse(req.body);
    const doc = await addVersion(req.tenantId, req.params.did, {
      storageKey: data.storageKey,
      uploadedBy: req.user.userId,
      fileSize: data.fileSize,
      mimeType: data.mimeType
    });
    return success(res, doc, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    if (err.message === 'NOT_FOUND' || err.status === 404) return fail(res, 'NOT_FOUND', 'Original document not found.', 404);
    console.error('[Documents Router] add version error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to instantiate document version.', 500);
  }
});

// PATCH /api/projects/:projectId/documents/:documentId/visibility
router.patch('/:documentId/visibility', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { projectId, documentId } = req.params;
    const { isVisibleToClient } = req.body;
    const tenantId = req.tenantId;

    if (typeof isVisibleToClient !== 'boolean') {
      return fail(res, 'VALIDATION_ERROR', 'isVisibleToClient must be a boolean', 400);
    }

    const query = `
      UPDATE documents
      SET is_visible_to_client = $1
      WHERE id = $2 AND project_id = $3 AND tenant_id = $4
      RETURNING *
    `;
    const { rows } = await pool.query(query, [isVisibleToClient, documentId, projectId, tenantId]);
    if (rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Document not found.', 404);
    }
    return success(res, rows[0]);
  } catch (err) {
    console.error('[Documents Router] Patch visibility error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update visibility.', 500);
  }
});

// GET /api/projects/:projectId/documents/:documentId/comments
router.get('/:documentId/comments', authorize('projects:read'), async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const tenantId = req.tenantId;

    const query = `
      SELECT id, comment, created_by_client, created_by_name, created_at
      FROM design_item_comments
      WHERE document_id = $1 AND tenant_id = $2
      ORDER BY created_at ASC
    `;
    const { rows } = await pool.query(query, [documentId, tenantId]);
    return success(res, rows);
  } catch (err) {
    console.error('[Documents Router] Get comments error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch comments.', 500);
  }
});

// POST /api/projects/:projectId/documents/:documentId/comments
router.post('/:documentId/comments', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { projectId, documentId } = req.params;
    const { comment } = req.body;
    const tenantId = req.tenantId;
    const creatorName = req.user?.name || req.user?.username || 'Project Team';

    if (!comment || !comment.trim()) {
      return fail(res, 'VALIDATION_ERROR', 'Comment cannot be empty', 400);
    }

    // Verify the document exists in this project
    const check = await pool.query(
      `SELECT id FROM documents WHERE id = $1 AND project_id = $2 AND tenant_id = $3`,
      [documentId, projectId, tenantId]
    );
    if (check.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Document not found.', 404);
    }

    const query = `
      INSERT INTO design_item_comments (
        tenant_id, document_id, comment, created_by_client, created_by_name
      ) VALUES ($1, $2, $3, false, $4)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [tenantId, documentId, comment.trim(), creatorName]);
    return success(res, rows[0], {}, 201);
  } catch (err) {
    console.error('[Documents Router] Create comment error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to add comment.', 500);
  }
});

module.exports = router;
