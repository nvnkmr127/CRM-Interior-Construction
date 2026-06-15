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
      SELECT id, name, doc_type, storage_key, file_size_bytes, mime_type, created_at
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

module.exports = router;
