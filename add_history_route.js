const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'server/src/routes/financialApprovals.js');
let content = fs.readFileSync(file, 'utf8');

const historyCode = `
// GET /api/financial-approvals/:id/attachments/:attachmentId/history
router.get('/:id/attachments/:attachmentId/history', async (req, res, next) => {
  try {
    const { id, attachmentId } = req.params;
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    
    // Recursive CTE to fetch full version history for this attachment lineage
    const query = \`
      WITH RECURSIVE attachment_tree AS (
        SELECT * FROM financial_approval_attachments 
        WHERE id = $1 AND approval_id = $2 AND tenant_id = $3
        
        UNION ALL
        
        SELECT a.* FROM financial_approval_attachments a
        INNER JOIN attachment_tree t ON a.id = t.parent_id
      )
      SELECT a.*, u.name as uploaded_by_name 
      FROM attachment_tree a
      LEFT JOIN users u ON a.uploaded_by = u.id
      ORDER BY a.version DESC
    \`;
    
    const { rows } = await pool.query(query, [attachmentId, id, tenantId]);
    return success(res, rows);
  } catch (error) {
    next(error);
  }
});
`;

content = content.replace('module.exports = router;', historyCode + '\nmodule.exports = router;');
fs.writeFileSync(file, content);
console.log('History Route added');
