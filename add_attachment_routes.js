const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'server/src/routes/financialApprovals.js');
let content = fs.readFileSync(file, 'utf8');

const uploadCode = `
const multer = require('multer');
const path = require('path');
const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    cb(null, 'uploads/attachments/');
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 50 * 1024 * 1024 } // 50MB
});

// GET /api/financial-approvals/:id/attachments
router.get('/:id/attachments', async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    
    // Check if approval exists
    const approvalRes = await pool.query('SELECT 1 FROM financial_approvals WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (approvalRes.rows.length === 0) return fail(res, 'NOT_FOUND', 'Approval not found', 404);

    const query = \`
      SELECT a.*, u.name as uploaded_by_name
      FROM financial_approval_attachments a
      LEFT JOIN users u ON a.uploaded_by = u.id
      WHERE a.approval_id = $1 AND a.tenant_id = $2 AND a.status = 'active'
      ORDER BY a.created_at DESC
    \`;
    const { rows } = await pool.query(query, [id, tenantId]);
    return success(res, rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-approvals/:id/attachments
router.post('/:id/attachments', upload.array('files'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const userId = req.user.id || req.user.userId;

    if (!req.files || req.files.length === 0) {
      return fail(res, 'BAD_REQUEST', 'No files uploaded', 400);
    }

    // Mock Virus Scan
    await new Promise(resolve => setTimeout(resolve, 1500)); 

    const uploadedAttachments = [];
    for (const file of req.files) {
      const fileUrl = \`\${process.env.API_URL || 'http://localhost:3000'}/uploads/attachments/\${file.filename}\`;
      const query = \`
        INSERT INTO financial_approval_attachments 
        (tenant_id, approval_id, name, url, mime_type, size_bytes, uploaded_by)
        VALUES ($1, $2, $3, $4, $5, $6, $7)
        RETURNING *
      \`;
      const { rows } = await pool.query(query, [tenantId, id, file.originalname, fileUrl, file.mimetype, file.size, userId]);
      uploadedAttachments.push(rows[0]);
    }
    
    logActivity(req, 'financial_approval', id, 'Edited', null, JSON.stringify({ event: 'Added Attachments', count: uploadedAttachments.length }));
    return success(res, uploadedAttachments);
  } catch (error) {
    next(error);
  }
});

// PUT /api/financial-approvals/:id/attachments/:attachmentId/replace
router.put('/:id/attachments/:attachmentId/replace', upload.single('file'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { id, attachmentId } = req.params;
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const userId = req.user.id || req.user.userId;

    if (!req.file) return fail(res, 'BAD_REQUEST', 'No file provided', 400);

    // Mock Virus Scan
    await new Promise(resolve => setTimeout(resolve, 1500));

    await client.query('BEGIN');
    
    // Get old attachment
    const oldQuery = "SELECT * FROM financial_approval_attachments WHERE id = $1 AND approval_id = $2 AND tenant_id = $3 AND status = 'active' FOR UPDATE";
    const oldRes = await client.query(oldQuery, [attachmentId, id, tenantId]);
    
    if (oldRes.rows.length === 0) {
      await client.query('ROLLBACK');
      return fail(res, 'NOT_FOUND', 'Attachment not found or inactive', 404);
    }
    const oldDoc = oldRes.rows[0];

    // Mark old as replaced
    await client.query("UPDATE financial_approval_attachments SET status = 'replaced' WHERE id = $1", [attachmentId]);

    // Insert new version
    const fileUrl = \`\${process.env.API_URL || 'http://localhost:3000'}/uploads/attachments/\${req.file.filename}\`;
    const newQuery = \`
      INSERT INTO financial_approval_attachments 
      (tenant_id, approval_id, name, url, mime_type, size_bytes, uploaded_by, version, parent_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    \`;
    const { rows } = await client.query(newQuery, [tenantId, id, req.file.originalname, fileUrl, req.file.mimetype, req.file.size, userId, (oldDoc.version || 1) + 1, attachmentId]);

    await client.query('COMMIT');
    logActivity(req, 'financial_approval', id, 'Edited', null, JSON.stringify({ event: 'Replaced Attachment', file: req.file.originalname }));
    
    return success(res, rows[0]);
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// DELETE /api/financial-approvals/:id/attachments/:attachmentId
router.delete('/:id/attachments/:attachmentId', async (req, res, next) => {
  try {
    const { id, attachmentId } = req.params;
    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    const { rows } = await pool.query('DELETE FROM financial_approval_attachments WHERE id = $1 AND approval_id = $2 AND tenant_id = $3 RETURNING *', [attachmentId, id, tenantId]);
    
    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Attachment not found', 404);

    logActivity(req, 'financial_approval', id, 'Edited', null, JSON.stringify({ event: 'Deleted Attachment', file: rows[0].name }));
    return success(res, { success: true });
  } catch (error) {
    next(error);
  }
});
`;

content = content.replace('module.exports = router;', uploadCode + '\nmodule.exports = router;');
fs.writeFileSync(file, content);
console.log('Routes added');
