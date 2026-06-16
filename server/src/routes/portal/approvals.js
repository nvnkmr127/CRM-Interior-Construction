const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const authenticatePortal = require('../../middleware/authenticatePortal');
const documentVersionService = require('../../services/documents/documentVersionService');

router.use(authenticatePortal);

// Mock S3 pre-signed URL generator
const generatePresignedUrl = async (key) => {
  return `https://s3.stub.url/download/${encodeURIComponent(key)}?expires=3600`;
};

// GET /api/portal/approvals
router.get('/', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const query = `
      SELECT id, name, doc_type, version, storage_key, created_at
      FROM documents
      WHERE project_id = $1 AND tenant_id = $2 
        AND is_visible_to_client = true 
        AND status = 'pending_review'
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [projectId, tenantId]);

    const documents = await Promise.all(result.rows.map(async doc => {
      const downloadUrl = await generatePresignedUrl(doc.storage_key);
      return { ...doc, downloadUrl };
    }));

    res.json({ success: true, data: documents });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/approvals/:docId/approve
router.post('/:docId/approve', async (req, res, next) => {
  try {
    const { projectId, tenantId, id: clientPortalUserId } = req.portalUser;
    const { docId } = req.params;

    // Verify doc belongs to user's project and is visible
    const docResult = await pool.query(
      `SELECT id FROM documents WHERE id = $1 AND project_id = $2 AND tenant_id = $3 AND is_visible_to_client = true`,
      [docId, projectId, tenantId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found or not visible' });
    }

    // Approve document. Note: userId is null for client approvals.
    await documentVersionService.approveDocument(tenantId, docId, null);

    // Record separately in a metadata field
    const metadataUpdate = await pool.query(
      `UPDATE documents 
       SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{client_approval}', $1) 
       WHERE id = $2 
       RETURNING *`,
      [JSON.stringify({ approved_by_client: clientPortalUserId, approved_at: new Date() }), docId]
    );

    res.json({ success: true, data: metadataUpdate.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/approvals/:docId/revision
router.post('/:docId/revision', async (req, res, next) => {
  try {
    const { projectId, tenantId, id: clientPortalUserId } = req.portalUser;
    const { docId } = req.params;
    const { note } = req.body;

    if (!note) {
      return res.status(400).json({ success: false, message: 'Revision note is required' });
    }

    // Verify doc belongs to user's project and is visible
    const docResult = await pool.query(
      `SELECT id FROM documents WHERE id = $1 AND project_id = $2 AND tenant_id = $3 AND is_visible_to_client = true`,
      [docId, projectId, tenantId]
    );

    if (docResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found or not visible' });
    }

    // Request revision. Note: userId is null for client request.
    await documentVersionService.requestRevision(tenantId, docId, note, null);

    // Record separately in metadata field
    const metadataUpdate = await pool.query(
      `UPDATE documents 
       SET metadata = jsonb_set(COALESCE(metadata, '{}'), '{client_revision_request}', $1) 
       WHERE id = $2 
       RETURNING *`,
      [JSON.stringify({ requested_by_client: clientPortalUserId, requested_at: new Date() }), docId]
    );

    res.json({ success: true, data: metadataUpdate.rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
