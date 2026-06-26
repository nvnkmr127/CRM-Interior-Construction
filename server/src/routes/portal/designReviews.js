const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const authenticatePortal = require('../../middleware/authenticatePortal');
const { getDocumentUrl } = require('../../services/documents/documentService');

router.use(authenticatePortal);

// GET /api/portal/design-reviews/rounds
router.get('/rounds', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const query = `
      SELECT id, name, status, decision_note, client_reviewed_at, created_at, updated_at
      FROM design_review_rounds
      WHERE project_id = $1 AND tenant_id = $2
      ORDER BY created_at ASC
    `;

    const { rows } = await pool.query(query, [projectId, tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/design-reviews/rounds/:id/drawings
router.get('/rounds/:id/drawings', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { id } = req.params;

    const query = `
      SELECT id, name, doc_type, version, storage_key, status, revision_note, created_at, design_review_round_id
      FROM documents
      WHERE design_review_round_id = $1 AND project_id = $2 AND tenant_id = $3 AND is_visible_to_client = true
      ORDER BY created_at ASC
    `;

    const { rows } = await pool.query(query, [id, projectId, tenantId]);

    const result = await Promise.all(rows.map(async doc => {
      let downloadUrl = '';
      try {
        downloadUrl = await getDocumentUrl(doc.storage_key);
      } catch (e) {
        console.error(e);
      }
      return { ...doc, downloadUrl };
    }));

    res.json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/design-reviews/drawings/:documentId/approve
router.post('/drawings/:documentId/approve', async (req, res, next) => {
  try {
    const { projectId, tenantId, id: clientPortalUserId } = req.portalUser;
    const { documentId } = req.params;

    // Verify drawing belongs to project and is visible
    const check = await pool.query(
      `SELECT id FROM documents WHERE id = $1 AND project_id = $2 AND tenant_id = $3 AND is_visible_to_client = true`,
      [documentId, projectId, tenantId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Drawing not found or not visible' });
    }

    const query = `
      UPDATE documents 
      SET status = 'approved', approved_at = NOW(), revision_note = NULL
      WHERE id = $1 AND project_id = $2 AND tenant_id = $3
      RETURNING *
    `;

    const { rows } = await pool.query(query, [documentId, projectId, tenantId]);
    res.json({ success: true, data: rows[0], message: 'Drawing approved successfully.' });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/design-reviews/drawings/:documentId/revision
router.post('/drawings/:documentId/revision', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { documentId } = req.params;
    const { note } = req.body;

    if (!note || !note.trim()) {
      return res.status(400).json({ success: false, message: 'Revision note is required' });
    }

    // Verify drawing belongs to project and is visible
    const check = await pool.query(
      `SELECT id FROM documents WHERE id = $1 AND project_id = $2 AND tenant_id = $3 AND is_visible_to_client = true`,
      [documentId, projectId, tenantId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Drawing not found or not visible' });
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const updateDocQuery = `
        UPDATE documents 
        SET status = 'revision_requested', revision_note = $4
        WHERE id = $1 AND project_id = $2 AND tenant_id = $3
        RETURNING *
      `;
      const { rows } = await client.query(updateDocQuery, [documentId, projectId, tenantId, note.trim()]);

      await client.query(
        `UPDATE projects SET current_design_revisions = current_design_revisions + 1 WHERE id = $1 AND tenant_id = $2`,
        [projectId, tenantId]
      );

      await client.query('COMMIT');
      res.json({ success: true, data: rows[0], message: 'Revision requested on drawing.' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/design-reviews/drawings/:documentId/comments
router.get('/drawings/:documentId/comments', async (req, res, next) => {
  try {
    const { tenantId } = req.portalUser;
    const { documentId } = req.params;

    const query = `
      SELECT * FROM design_item_comments 
      WHERE document_id = $1 AND tenant_id = $2 
      ORDER BY created_at ASC
    `;

    const { rows } = await pool.query(query, [documentId, tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/design-reviews/drawings/:documentId/comments
router.post('/drawings/:documentId/comments', async (req, res, next) => {
  try {
    const { tenantId, id: clientPortalUserId } = req.portalUser;
    const { documentId } = req.params;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: 'Comment is required' });
    }

    // Get client name
    const { rows: clientInfo } = await pool.query('SELECT name FROM client_portal_users WHERE id = $1', [clientPortalUserId]);
    const clientName = clientInfo[0]?.name || 'Client';

    const query = `
      INSERT INTO design_item_comments (tenant_id, document_id, comment, created_by_client, created_by_name)
      VALUES ($1, $2, $3, true, $4)
      RETURNING *
    `;

    const { rows } = await pool.query(query, [tenantId, documentId, comment.trim(), clientName]);
    res.json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/design-reviews/freeze-design
router.post('/freeze-design', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const query = `
      UPDATE projects
      SET is_scope_locked = true, updated_at = NOW()
      WHERE id = $1 AND tenant_id = $2
      RETURNING id, name, is_scope_locked
    `;

    const { rows } = await pool.query(query, [projectId, tenantId]);
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }
    res.json({ success: true, data: rows[0], message: 'Design scope frozen successfully.' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
