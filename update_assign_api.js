const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'server/src/routes/financialApprovals.js');
let content = fs.readFileSync(file, 'utf8');

// 1. Rewrite POST /:id/assign
const oldAssignRegex = /router\.post\('\/:id\/assign', async \(req, res, next\) => \{[\s\S]*?\}\);/g;

const newAssignRoute = `router.post('/:id/assign', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const userId = req.user.id || req.user.userId;
    const { id } = req.params;
    const { assigned_to, backup_approver, assignment_notes } = req.body;
    
    const { rows: oldRows } = await pool.query('SELECT assigned_to, backup_approver FROM financial_approvals WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (oldRows.length === 0) return fail(res, 'NOT_FOUND', 'Approval not found', 404);
    
    const isReassign = oldRows[0].assigned_to != null;
    const action = isReassign ? 'Reassigned' : 'Assigned';
    
    await pool.query(
      \`UPDATE financial_approvals 
       SET assigned_to = $1, backup_approver = $2, assignment_notes = $3, assigned_by = $4, assigned_date = CURRENT_TIMESTAMP
       WHERE id = $5 AND tenant_id = $6\`,
      [assigned_to || null, backup_approver || null, assignment_notes || null, userId, id, tenantId]
    );
    
    logActivity(req, 'financial_approval', id, action, null, JSON.stringify({ assigned_to, backup_approver, notes: assignment_notes }));
    return success(res, { success: true });
  } catch (error) {
    next(error);
  }
});`;

content = content.replace(oldAssignRegex, newAssignRoute);

// 2. Modify GET / query to fetch names
// Look for SELECT and add LEFT JOINs for users
const selectRegex = /SELECT fa\.\*, u\.name as requester_name/g;
const newSelect = `SELECT fa.*, u.name as requester_name,
       a1.name as assigned_to_name,
       a2.name as backup_approver_name,
       a3.name as assigned_by_name`;
content = content.replace(selectRegex, newSelect);

const joinRegex = /FROM financial_approvals fa\s+LEFT JOIN users u ON fa\.requested_by = u\.id/g;
const newJoin = `FROM financial_approvals fa
      LEFT JOIN users u ON fa.requested_by = u.id
      LEFT JOIN users a1 ON fa.assigned_to = a1.id
      LEFT JOIN users a2 ON fa.backup_approver = a2.id
      LEFT JOIN users a3 ON fa.assigned_by = a3.id`;
content = content.replace(joinRegex, newJoin);

// 3. Update Bulk Route Assign Logic
const bulkAssignRegex = /else if \(action === 'assign'\) \{[\s\S]*?logActivity\(req, 'financial_approval', id, 'Assigned', null, JSON\.stringify\(\{ assignee \}\)\);\s*\}/g;
const newBulkAssign = `else if (action === 'assign') {
        const assignee = payload?.assignee_id;
        const backup = payload?.backup_approver;
        const notes = payload?.assignment_notes;
        if (!assignee) throw new Error('Assignee required');
        
        await client.query("UPDATE financial_approvals SET assigned_to = $1, backup_approver = $2, assignment_notes = $3, assigned_by = $4, assigned_date = CURRENT_TIMESTAMP WHERE id = $5", [assignee, backup || null, notes || null, userId, id]);
        logActivity(req, 'financial_approval', id, approval.assigned_to ? 'Reassigned' : 'Assigned', null, JSON.stringify({ assigned_to: assignee, backup_approver: backup }));
      }`;
content = content.replace(bulkAssignRegex, newBulkAssign);

fs.writeFileSync(file, content);
console.log('Done');
