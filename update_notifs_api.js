const fs = require('fs');
const path = require('path');

// 1. Create Notification Util
const utilFile = path.join(__dirname, 'server/src/utils/notifications.js');
const utilCode = `
const pool = require('../config/db');

async function sendNotification(tenantId, userId, type, message, referenceUrl = null, actorId = null) {
  if (!userId) return;
  try {
    await pool.query(
      'INSERT INTO notifications (tenant_id, user_id, type, message, reference_url, actor_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [tenantId, userId, type, message, referenceUrl, actorId]
    );
    // Mock Email Output
    console.log(\`[EMAIL MOCK] To: User(\${userId}) | Subject: New \${type} Notification | Body: \${message} | Link: \${referenceUrl || '#'}\`);
  } catch (err) {
    console.error('Error sending notification', err);
  }
}

module.exports = { sendNotification };
`;
fs.writeFileSync(utilFile, utilCode);

// 2. Patch notifications route
const notifRoute = path.join(__dirname, 'server/src/routes/notifications.js');
let notifCode = fs.readFileSync(notifRoute, 'utf8');
if (!notifCode.includes('/read-all')) {
  notifCode = notifCode.replace('module.exports = router;', `
router.put('/read-all', async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  try {
    await pool.query('UPDATE notifications SET is_read = true WHERE tenant_id = $1 AND user_id = $2', [tenantId, userId]);
    return success(res, { message: 'All notifications marked as read' });
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to update notifications', 500);
  }
});

module.exports = router;
`);
  fs.writeFileSync(notifRoute, notifCode);
}

// 3. Patch financial approvals route
const faRoute = path.join(__dirname, 'server/src/routes/financialApprovals.js');
let faCode = fs.readFileSync(faRoute, 'utf8');

if (!faCode.includes('sendNotification')) {
  faCode = `const { sendNotification } = require('../utils/notifications');\n` + faCode;
}

// Remind Route
if (!faCode.includes('/remind')) {
  const remindRoute = `
// POST /api/financial-approvals/:id/remind
router.post('/:id/remind', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const userId = req.user.id;
    const { id } = req.params;
    
    const { rows } = await pool.query('SELECT * FROM financial_approvals WHERE id = $1 AND tenant_id = $2', [id, tenantId]);
    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Approval not found', 404);
    const app = rows[0];
    
    if (app.assigned_to) {
      await sendNotification(tenantId, app.assigned_to, 'Reminder', \`Reminder: Please review pending \${app.transaction_type} request.\`, \`/finance/approvals?id=\${id}\`, userId);
    }
    
    logActivity(req, 'financial_approval', id, 'Reminder Sent', null, JSON.stringify({ sent_to: app.assigned_to }));
    return success(res, { success: true });
  } catch (err) {
    next(err);
  }
});
`;
  faCode = faCode.replace('module.exports = router;', remindRoute + '\nmodule.exports = router;');
}

// Escalate hook
faCode = faCode.replace(
  /await pool\.query\("UPDATE financial_approvals SET escalation_level = \$1 WHERE id = \$2", \[newLevel, row\.id\]\);/g,
  `await pool.query("UPDATE financial_approvals SET escalation_level = $1 WHERE id = $2", [newLevel, row.id]);
        await sendNotification(tenantId, row.requested_by, 'Escalated', \`Approval \${row.id} has been escalated to Level \${newLevel}\`, \`/finance/approvals?id=\${row.id}\`);`
);

// Assign hook
faCode = faCode.replace(
  /logActivity\(req, 'financial_approval', id, 'Assigned', null, JSON\.stringify\(\{ assigned_to \}\)\);/g,
  `logActivity(req, 'financial_approval', id, 'Assigned', null, JSON.stringify({ assigned_to }));
    if (assigned_to) {
      await sendNotification(tenantId, assigned_to, 'Approval Assigned', \`You have been assigned a financial approval request.\`, \`/finance/approvals?id=\${id}\`, userId);
    }`
);

// Approve hook
faCode = faCode.replace(
  /logActivity\(req, 'financial_approval', id, 'Approved', null, null\);/g,
  `logActivity(req, 'financial_approval', id, 'Approved', null, null);
    const { rows: tmp } = await pool.query('SELECT requested_by FROM financial_approvals WHERE id = $1', [id]);
    if (tmp.length > 0) {
      await sendNotification(tenantId, tmp[0].requested_by, 'Approved', \`Your financial approval request has been approved.\`, \`/finance/approvals?id=\${id}\`, userId);
    }`
);

// Reject hook
faCode = faCode.replace(
  /logActivity\(req, 'financial_approval', id, 'Rejected', null, JSON\.stringify\(\{ rejectionReason \}\)\);/g,
  `logActivity(req, 'financial_approval', id, 'Rejected', null, JSON.stringify({ rejectionReason }));
    const { rows: tmp } = await pool.query('SELECT requested_by FROM financial_approvals WHERE id = $1', [id]);
    if (tmp.length > 0) {
      await sendNotification(tenantId, tmp[0].requested_by, 'Rejected', \`Your financial approval request was rejected: \${rejectionReason}\`, \`/finance/approvals?id=\${id}\`, userId);
    }`
);

// Mention hook
faCode = faCode.replace(
  /await pool\.query\(\s*'INSERT INTO financial_approval_comments \(tenant_id, approval_id, user_id, comment\) VALUES \(\$1, \$2, \$3, \$4\)',\s*\[tenantId, id, userId, comment\]\s*\);/g,
  `await pool.query('INSERT INTO financial_approval_comments (tenant_id, approval_id, user_id, comment) VALUES ($1, $2, $3, $4)', [tenantId, id, userId, comment]);
    const mentionMatch = comment.match(/@(\\w+)/);
    if (mentionMatch) {
      const { rows: uRows } = await pool.query('SELECT id FROM users WHERE first_name ILIKE $1 OR last_name ILIKE $1 LIMIT 1', [mentionMatch[1]]);
      if (uRows.length > 0) {
        await sendNotification(tenantId, uRows[0].id, 'Mentioned', \`You were mentioned in a comment.\`, \`/finance/approvals?id=\${id}\`, userId);
      }
    }`
);

fs.writeFileSync(faRoute, faCode);
console.log('Backend patched with Notifications');
