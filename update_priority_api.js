const fs = require('fs');
const path = require('path');
const file = path.join(__dirname, 'server/src/routes/financialApprovals.js');
let content = fs.readFileSync(file, 'utf8');

const regexPostPriority = /\/\/ POST \/api\/financial-approvals\/:id\/priority/;
if (!regexPostPriority.test(content)) {
  const newRoute = `
// POST /api/financial-approvals/:id/priority
router.post('/:id/priority', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const { id } = req.params;
    const { priority } = req.body;
    
    if (!['low', 'medium', 'high', 'critical'].includes(priority)) {
      return fail(res, 'BAD_REQUEST', 'Invalid priority', 400);
    }

    const { rows } = await pool.query('UPDATE financial_approvals SET priority = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *', [priority, id, tenantId]);
    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Approval not found', 404);
    
    logActivity(req, 'financial_approval', id, 'Priority Updated', null, JSON.stringify({ priority }));
    return success(res, { success: true, priority });
  } catch (error) {
    next(error);
  }
});
`;
  content = content.replace('module.exports = router;', newRoute + '\nmodule.exports = router;');
}

const getRegexSort = /ORDER BY ([\s\S]*?) (ASC|DESC)/g;
content = content.replace(getRegexSort, (match, p1, p2) => {
    return 'ORDER BY ' +
    'CASE ' +
      "WHEN '" + "${sort || ''}" + "' = 'priority_desc' THEN (CASE priority WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END) " +
      "WHEN '" + "${sort || ''}" + "' = 'priority_asc' THEN (CASE priority WHEN 'critical' THEN 4 WHEN 'high' THEN 3 WHEN 'medium' THEN 2 WHEN 'low' THEN 1 ELSE 0 END) " +
    "END ${sort === 'priority_asc' ? 'ASC' : 'DESC'}, " +
    "fa.updated_at DESC";
});
// Need to add where clause filter
const getRegexFilter = /if \(status\) \{/g;
const filterInject = `
    if (req.query.priority) {
      const pList = req.query.priority.split(',').map(s => s.trim());
      conditions.push(\`fa.priority = ANY($\${params.length + 1})\`);
      params.push(pList);
    }
    if (status) {`;
content = content.replace(getRegexFilter, filterInject);

// Auto-priority on POST
const regexPostCreate = /const \{ transaction_type, target_id, amount, requested_changes, threshold_limit \} = req.body;/g;
const replacePostCreate = `const { transaction_type, target_id, amount, requested_changes, threshold_limit } = req.body;
      let priority = 'low';
      if (amount >= 20000) priority = 'critical';
      else if (amount >= 5000) priority = 'high';
      else if (amount >= 1000) priority = 'medium';`;
content = content.replace(regexPostCreate, replacePostCreate);

const insertRegex = /INSERT INTO financial_approvals \(tenant_id, transaction_type, target_id, amount, requested_by, requested_changes, status, threshold_limit\) VALUES \(\$1, \$2, \$3, \$4, \$5, \$6, 'pending', \$7\)/g;
const newInsert = `INSERT INTO financial_approvals (tenant_id, transaction_type, target_id, amount, requested_by, requested_changes, status, threshold_limit, priority) VALUES ($1, $2, $3, $4, $5, $6, 'pending', $7, $8)`;
content = content.replace(insertRegex, newInsert);
content = content.replace(/\[tenantId, transaction_type, target_id, amount, userId, JSON\.stringify\(requested_changes\), threshold_limit\]/g, `[tenantId, transaction_type, target_id, amount, userId, JSON.stringify(requested_changes), threshold_limit, priority]`);

fs.writeFileSync(file, content);
console.log('Backend patched');
