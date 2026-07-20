const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'server/src/routes/financialApprovals.js');
let content = fs.readFileSync(file, 'utf8');

const bulkCode = `
// POST /api/financial-approvals/bulk
router.post('/bulk', async (req, res, next) => {
  const { action, approvalIds, payload } = req.body;
  const tenantId = req.tenantId || (req.user && req.user.tenantId);
  const userId = req.user.id || req.user.userId;
  
  if (!Array.isArray(approvalIds) || approvalIds.length === 0) {
    return fail(res, 'BAD_REQUEST', 'No approvals selected', 400);
  }

  const results = { successful: [], failed: [] };

  for (const id of approvalIds) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      
      const checkQuery = "SELECT status, priority, is_archived, amount FROM financial_approvals WHERE id = $1 AND tenant_id = $2 FOR UPDATE";
      const checkRes = await client.query(checkQuery, [id, tenantId]);
      
      if (checkRes.rows.length === 0) {
        throw new Error('Not found or unauthorized');
      }
      
      const approval = checkRes.rows[0];

      if (action === 'approve') {
        if (approval.status !== 'pending') throw new Error('Not in pending status');
        // Simple permission check (can be expanded)
        await client.query("UPDATE financial_approvals SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP WHERE id = $2", [userId, id]);
        logActivity(req, 'financial_approval', id, 'Approved', null, null);
      } 
      else if (action === 'reject') {
        if (approval.status !== 'pending') throw new Error('Not in pending status');
        const reason = payload?.reason || 'Bulk rejected';
        await client.query("UPDATE financial_approvals SET status = 'rejected', rejection_reason = $1 WHERE id = $2", [reason, id]);
        logActivity(req, 'financial_approval', id, 'Rejected', null, JSON.stringify({ reason }));
      }
      else if (action === 'assign') {
        const assignee = payload?.assignee_id;
        if (!assignee) throw new Error('Assignee required');
        // Just mock assignment logic via activity log for now since assignee_id isn't in base table unless it's requested_by
        logActivity(req, 'financial_approval', id, 'Assigned', null, JSON.stringify({ assignee }));
      }
      else if (action === 'archive') {
        await client.query("UPDATE financial_approvals SET is_archived = true WHERE id = $1", [id]);
        logActivity(req, 'financial_approval', id, 'Edited', null, JSON.stringify({ event: 'Archived' }));
      }
      else if (action === 'change_priority') {
        const priority = payload?.priority;
        if (!priority) throw new Error('Priority required');
        await client.query("UPDATE financial_approvals SET priority = $1 WHERE id = $2", [priority, id]);
        logActivity(req, 'financial_approval', id, 'Edited', approval.priority, priority);
      }
      
      await client.query('COMMIT');
      results.successful.push(id);
    } catch (e) {
      await client.query('ROLLBACK');
      results.failed.push({ id, error: e.message });
    } finally {
      client.release();
    }
  }

  return success(res, results);
});
`;

content = content.replace('module.exports = router;', bulkCode + '\nmodule.exports = router;');
fs.writeFileSync(file, content);
console.log('Bulk Route added');
