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
    const doc = await approveDocument(req.tenantId, req.params.did, req.user.userId);
    return success(res, doc);
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

module.exports = router;
