const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const authenticatePortal = require('../../middleware/authenticatePortal');
// Assuming an s3 stub or helper exists, we can mock it here or require if it exists.
// For now, we'll return a mock URL if we don't have a specific S3 helper.
const generatePresignedUrl = async (key) => {
  // STUB: Replace with actual AWS S3 getSignedUrl in production
  return `https://s3.stub.url/download/${encodeURIComponent(key)}?expires=3600`;
};

router.use(authenticatePortal);

// GET /api/portal/project
router.get('/', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const query = `
      SELECT 
        p.id,
        p.name, 
        p.client_name, 
        p.status, 
        p.start_date, 
        p.target_date,
        p.is_scope_locked,
        COALESCE(p.contract_value, 0) AS contract_value,
        pm_user.name AS pm_name,
        designer_user.name AS designer_name,
        (
          SELECT pp.name 
          FROM project_phases pp 
          WHERE pp.project_id = p.id AND pp.status = 'in_progress' 
          ORDER BY pp.sort_order ASC 
          LIMIT 1
        ) as current_phase,
        (
          SELECT 
            COALESCE(ROUND(COUNT(*) FILTER (WHERE status = 'completed') * 100.0 / NULLIF(COUNT(*), 0)), 0)
          FROM tasks t WHERE t.project_id = p.id
        ) as task_completion_pct
      FROM projects p
      LEFT JOIN users pm_user ON p.pm_id = pm_user.id
      LEFT JOIN users designer_user ON p.designer_id = designer_user.id
      WHERE p.id = $1 AND p.tenant_id = $2
    `;

    const result = await pool.query(query, [projectId, tenantId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Project not found' });
    }

    res.json({ success: true, data: result.rows[0] });
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/project/phases
router.get('/phases', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const query = `
      SELECT 
        p.id, 
        p.name, 
        p.status, 
        p.sort_order,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', m.id,
              'name', m.name, 
              'description', m.description,
              'status', m.status, 
              'due_date', m.due_date,
              'sort_order', m.sort_order
            ) ORDER BY m.sort_order ASC) 
            FROM milestones m 
            WHERE m.phase_id = p.id
          ),
          '[]'::json
        ) as milestones
      FROM project_phases p
      WHERE p.project_id = $1 AND p.tenant_id = $2
      ORDER BY p.sort_order ASC
    `;

    const result = await pool.query(query, [projectId, tenantId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/project/documents
router.get('/documents', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const query = `
      SELECT id, name, doc_type, storage_key, file_size_bytes, mime_type, created_at, client_acknowledged_at, client_acknowledged_by
      FROM documents
      WHERE project_id = $1 AND tenant_id = $2 AND is_visible_to_client = true
      ORDER BY created_at DESC
    `;

    const result = await pool.query(query, [projectId, tenantId]);
    
    const documents = await Promise.all(result.rows.map(async doc => {
      const downloadUrl = await generatePresignedUrl(doc.storage_key);
      return {
        id: doc.id,
        name: doc.name,
        docType: doc.doc_type,
        fileSizeBytes: doc.file_size_bytes,
        mimeType: doc.mime_type,
        createdAt: doc.created_at,
        clientAcknowledgedAt: doc.client_acknowledged_at,
        clientAcknowledgedBy: doc.client_acknowledged_by,
        downloadUrl
      };
    }));

    res.json({ success: true, data: documents });
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/project/payments
router.get('/payments', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const query = `
      SELECT id, name, amount, due_date, status
      FROM payment_milestones
      WHERE project_id = $1 AND tenant_id = $2
      ORDER BY due_date ASC NULLS LAST, created_at ASC
    `;

    const result = await pool.query(query, [projectId, tenantId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/project/payments/:id/pay
router.post('/payments/:paymentId/pay', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { paymentId } = req.params;

    // Simulate payment processing
    const query = `
      UPDATE payment_milestones 
      SET status = 'paid', paid_at = NOW(), paid_amount = amount 
      WHERE id = $1 AND project_id = $2 AND tenant_id = $3
      RETURNING *
    `;

    const result = await pool.query(query, [paymentId, projectId, tenantId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Payment milestone not found' });
    }

    res.json({ success: true, data: result.rows[0], message: 'Payment successful' });
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/project/meeting-notes
router.get('/meeting-notes', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const query = `
      SELECT 
        mn.*,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', mai.id,
              'description', mai.description,
              'owner_name', mai.owner_name,
              'due_date', mai.due_date,
              'status', mai.status
            ) ORDER BY mai.due_date ASC NULLS LAST, mai.created_at ASC)
            FROM meeting_action_items mai
            WHERE mai.meeting_id = mn.id
          ),
          '[]'::json
        ) as action_items
      FROM meeting_notes mn
      WHERE mn.project_id = $1 AND mn.tenant_id = $2
      ORDER BY mn.meeting_date DESC, mn.created_at DESC
    `;

    const result = await pool.query(query, [projectId, tenantId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/project/meeting-notes/:id/sign-off
router.post('/meeting-notes/:id/sign-off', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { id } = req.params;

    const query = `
      UPDATE meeting_notes 
      SET client_sign_off_status = 'signed_off', client_signed_off_at = NOW()
      WHERE id = $1 AND project_id = $2 AND tenant_id = $3
      RETURNING *
    `;

    const result = await pool.query(query, [id, projectId, tenantId]);
    
    if (result.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Meeting note not found' });
    }

    res.json({ success: true, data: result.rows[0], message: 'Meeting notes signed off successfully' });
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/project/delay-notifications
router.get('/delay-notifications', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;

    const query = `
      SELECT dn.id, dn.type, dn.original_date, dn.revised_date, dn.reason, dn.message_draft as message, dn.sent_at, m.name as milestone_name
      FROM delay_notifications dn
      LEFT JOIN milestones m ON dn.milestone_id = m.id
      WHERE dn.project_id = $1 AND dn.tenant_id = $2 AND dn.status = 'sent'
      ORDER BY dn.sent_at DESC
    `;

    const result = await pool.query(query, [projectId, tenantId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/project/documents/:documentId/acknowledge
router.post('/documents/:documentId/acknowledge', async (req, res, next) => {
  try {
    const { projectId, tenantId, name: clientName } = req.portalUser;
    const { documentId } = req.params;

    const query = `
      UPDATE documents
      SET client_acknowledged_at = NOW(), client_acknowledged_by = $1
      WHERE id = $2 AND project_id = $3 AND tenant_id = $4 AND is_visible_to_client = true
      RETURNING *
    `;
    const { rows } = await pool.query(query, [clientName, documentId, projectId, tenantId]);
    
    if (rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found or not visible' });
    }

    res.json({ success: true, data: rows[0], message: 'Document acknowledged successfully.' });
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/project/documents/:documentId/comments
router.get('/documents/:documentId/comments', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const { documentId } = req.params;

    const check = await pool.query(
      `SELECT id FROM documents WHERE id = $1 AND project_id = $2 AND tenant_id = $3 AND is_visible_to_client = true`,
      [documentId, projectId, tenantId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found or not visible' });
    }

    const query = `
      SELECT id, comment, created_by_client, created_by_name, created_at
      FROM design_item_comments
      WHERE document_id = $1 AND tenant_id = $2
      ORDER BY created_at ASC
    `;
    const { rows } = await pool.query(query, [documentId, tenantId]);
    res.json({ success: true, data: rows });
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/project/documents/:documentId/comments
router.post('/documents/:documentId/comments', async (req, res, next) => {
  try {
    const { projectId, tenantId, name: clientName } = req.portalUser;
    const { documentId } = req.params;
    const { comment } = req.body;

    if (!comment || !comment.trim()) {
      return res.status(400).json({ success: false, message: 'Comment cannot be empty' });
    }

    const check = await pool.query(
      `SELECT id FROM documents WHERE id = $1 AND project_id = $2 AND tenant_id = $3 AND is_visible_to_client = true`,
      [documentId, projectId, tenantId]
    );
    if (check.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Document not found or not visible' });
    }

    const query = `
      INSERT INTO design_item_comments (
        tenant_id, document_id, comment, created_by_client, created_by_name
      ) VALUES ($1, $2, $3, true, $4)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [tenantId, documentId, comment.trim(), clientName]);
    res.status(201).json({ success: true, data: rows[0] });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
