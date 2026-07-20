const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'server/src/routes/financialApprovals.js');
let content = fs.readFileSync(file, 'utf8');

const newRoutes = `
// POST /api/financial-approvals/:id/reopen
router.post('/:id/reopen', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const { id } = req.params;
    
    const { rows } = await pool.query("SELECT status FROM financial_approvals WHERE id = $1 AND tenant_id = $2 FOR UPDATE", [id, tenantId]);
    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Approval not found', 404);
    if (rows[0].status !== 'rejected') return fail(res, 'BAD_REQUEST', 'Only rejected approvals can be reopened', 400);

    await pool.query(
      "UPDATE financial_approvals SET status = 'pending', rejection_reason = NULL, updated_at = CURRENT_TIMESTAMP WHERE id = $1", 
      [id]
    );
    
    logActivity(req, 'financial_approval', id, 'Reopened', null, null);
    return success(res, { success: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-approvals/:id/activity
router.post('/:id/activity', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { action, details } = req.body; // e.g. action: 'Downloaded', 'Opened'
    
    if (['Downloaded', 'Opened', 'Viewed', 'Exported'].includes(action)) {
      logActivity(req, 'financial_approval', id, action, null, details ? JSON.stringify(details) : null);
    }
    
    return success(res, { success: true });
  } catch (error) {
    next(error);
  }
});
`;

content = content.replace('module.exports = router;', newRoutes + '\nmodule.exports = router;');
fs.writeFileSync(file, content);
console.log('Routes added');
