const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const pool = require('../config/db');
const { getDocumentUrl } = require('../services/documents/documentService');
const { notifyUser } = require('../services/notificationService');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const createRoundSchema = z.object({
  name: z.string().min(1, 'Round name is required')
});

const associateDrawingSchema = z.object({
  design_review_round_id: z.string().uuid().nullable()
});

const createCommentSchema = z.object({
  comment: z.string().min(1, 'Comment is required')
});

// GET /api/projects/:projectId/design-reviews/rounds
router.get('/rounds', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;

    const query = `
      SELECT r.*, 
             COUNT(d.id)::int as total_drawings,
             COUNT(d.id) FILTER (WHERE d.status = 'approved')::int as approved_drawings,
             COUNT(d.id) FILTER (WHERE d.status = 'revision_requested')::int as revision_drawings
      FROM design_review_rounds r
      LEFT JOIN documents d ON d.design_review_round_id = r.id
      WHERE r.project_id = $1 AND r.tenant_id = $2
      GROUP BY r.id
      ORDER BY r.created_at ASC
    `;

    const { rows } = await pool.query(query, [projectId, tenantId]);
    return success(res, rows);
  } catch (err) {
    console.error('[DesignReviews Router] Get rounds error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch design review rounds.', 500);
  }
});

router.post('/rounds', authorize('design:manage'), validate(createRoundSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const data = req.body;

    const query = `
      INSERT INTO design_review_rounds (tenant_id, project_id, name, status)
      VALUES ($1, $2, $3, 'active')
      RETURNING *
    `;

    const { rows } = await pool.query(query, [tenantId, projectId, data.name]);
    return success(res, rows[0], {}, 201);
  } catch (err) {
    console.error('[DesignReviews Router] Create round error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create design review round.', 500);
  }
});

// POST /api/projects/:projectId/design-reviews/rounds/:id/close
router.post('/rounds/:id/close', authorize('design:manage'), async (req, res, next) => {
  try {
    const { projectId, id } = req.params;
    const tenantId = req.tenantId;

    const query = `
      UPDATE design_review_rounds
      SET status = 'completed', updated_at = NOW()
      WHERE id = $1 AND project_id = $2 AND tenant_id = $3
      RETURNING *
    `;

    const { rows } = await pool.query(query, [id, projectId, tenantId]);
    if (rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Design review round not found.', 404);
    }
    return success(res, rows[0]);
  } catch (err) {
    console.error('[DesignReviews Router] Close round error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to close design review round.', 500);
  }
});

// GET /api/projects/:projectId/design-reviews/drawings
router.get('/drawings', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const { roundId } = req.query;

    let query = `
      SELECT id, tenant_id, project_id, phase_id, task_id, name, doc_type, 
             version, storage_key, file_size_bytes, mime_type, uploaded_by, 
             status, approved_by, approved_at, revision_note, is_visible_to_client, 
             created_at, design_review_round_id
      FROM documents
      WHERE project_id = $1 AND tenant_id = $2 AND doc_type IN ('drawing', 'render')
    `;
    const values = [projectId, tenantId];

    if (roundId === 'unassigned') {
      query += ` AND design_review_round_id IS NULL`;
    } else if (roundId) {
      query += ` AND design_review_round_id = $3`;
      values.push(roundId);
    }

    query += ` ORDER BY created_at DESC`;

    const { rows } = await pool.query(query, values);

    // Populate presigned download URLs
    const result = await Promise.all(rows.map(async doc => {
      let downloadUrl = '';
      try {
        downloadUrl = await getDocumentUrl(doc.storage_key);
      } catch (e) {
        console.error(`Failed to get presigned URL for storageKey: ${doc.storage_key}`, e);
      }
      return { ...doc, downloadUrl };
    }));

    return success(res, result);
  } catch (err) {
    console.error('[DesignReviews Router] Get drawings error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch drawings.', 500);
  }
});

router.put('/drawings/:documentId', authorize('design:manage'), validate(associateDrawingSchema), async (req, res, next) => {
  try {
    const { projectId, documentId } = req.params;
    const tenantId = req.tenantId;
    const data = req.body;

    const query = `
      UPDATE documents
      SET design_review_round_id = $1
      WHERE id = $2 AND project_id = $3 AND tenant_id = $4
      RETURNING *
    `;

    const { rows } = await pool.query(query, [data.design_review_round_id, documentId, projectId, tenantId]);
    if (rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Drawing/render not found.', 404);
    }

    return success(res, rows[0]);
  } catch (err) {
    console.error('[DesignReviews Router] Associate drawing error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to associate drawing with round.', 500);
  }
});

// GET /api/projects/:projectId/design-reviews/drawings/:documentId/comments
router.get('/drawings/:documentId/comments', authorize('projects:read'), async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const tenantId = req.tenantId;

    const query = `
      SELECT * FROM design_item_comments 
      WHERE document_id = $1 AND tenant_id = $2 
      ORDER BY created_at ASC
    `;

    const { rows } = await pool.query(query, [documentId, tenantId]);
    return success(res, rows);
  } catch (err) {
    console.error('[DesignReviews Router] Get comments error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch comments.', 500);
  }
});

router.post('/drawings/:documentId/comments', authorize('design:manage'), validate(createCommentSchema), async (req, res, next) => {
  try {
    const { documentId } = req.params;
    const tenantId = req.tenantId;
    const data = req.body;
    const creatorName = req.user?.name || req.user?.username || 'Project Team';

    const query = `
      INSERT INTO design_item_comments (tenant_id, document_id, comment, created_by_client, created_by_name)
      VALUES ($1, $2, $3, false, $4)
      RETURNING *
    `;

    const { rows } = await pool.query(query, [tenantId, documentId, data.comment, creatorName]);
    return success(res, rows[0], {}, 201);
  } catch (err) {
    console.error('[DesignReviews Router] Add comment error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to add comment.', 500);
  }
});

// POST /api/projects/:projectId/freeze-design
router.post('/freeze-design', authorize('design:manage'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;

    const query = `
      UPDATE projects
      SET is_scope_locked = true, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, name, is_scope_locked
    `;

    const { rows } = await pool.query(query, [projectId, tenantId]);
    if (rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Project not found.', 404);
    }
    
    // Trigger CSAT survey for design phase completion
    notifyUser({
      tenantId,
      userId: null, // Depending on who to notify, usually project client. We'd ideally fetch client's ID.
      type: 'csat_survey_trigger',
      message: 'Your project design has been approved and locked! Please share your feedback on the design experience.',
      referenceUrl: `/client-portal/projects/${projectId}/surveys/design_approval`
    });

    return success(res, rows[0], { message: 'Design scope frozen and locked successfully.' });
  } catch (err) {
    console.error('[DesignReviews Router] Freeze design error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to freeze design scope.', 500);
  }
});

module.exports = router;
