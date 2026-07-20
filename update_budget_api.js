const fs = require('fs');
const path = require('path');

const utilFile = path.join(__dirname, 'server/src/utils/budgetValidator.js');
const utilCode = `
const pool = require('../config/db');

async function getProjectBudgetValidation(approvalId, tenantId) {
  // 1. Get the approval
  const { rows: appRows } = await pool.query('SELECT target_id, transaction_type, amount FROM financial_approvals WHERE id = $1 AND tenant_id = $2', [approvalId, tenantId]);
  if (appRows.length === 0) throw new Error('Approval not found');
  const app = appRows[0];
  
  // 2. Resolve project_id based on transaction type (Simplified logic for invoices/payments)
  // Usually, invoices point to projects, or payment_milestones point to projects.
  let projectId = null;
  
  if (app.transaction_type === 'invoice') {
    const { rows: inv } = await pool.query('SELECT project_id FROM invoices WHERE id = $1', [app.target_id]);
    if (inv.length > 0) projectId = inv[0].project_id;
  } else if (app.transaction_type === 'payment' || app.transaction_type === 'payment_update') {
    const { rows: pm } = await pool.query('SELECT project_id FROM payment_milestones WHERE id = $1', [app.target_id]);
    if (pm.length > 0) projectId = pm[0].project_id;
  }
  
  // Fallback if no project is found (e.g., independent refunds)
  if (!projectId) {
    return {
      status: 'safe',
      totalBudget: 0,
      consumedBudget: 0,
      remainingBudget: 0,
      requestAmount: Number(app.amount),
      afterApproval: 0,
      message: 'No project linked'
    };
  }
  
  // 3. Get Project Contract Value & Budgets
  let totalBudget = 0;
  const { rows: projRows } = await pool.query('SELECT contract_value FROM projects WHERE id = $1', [projectId]);
  if (projRows.length > 0 && projRows[0].contract_value) {
    totalBudget = Number(projRows[0].contract_value);
  } else {
    // Sum project_budgets
    const { rows: budgRows } = await pool.query('SELECT SUM(budgeted_cost) as total FROM project_budgets WHERE project_id = $1', [projectId]);
    if (budgRows.length > 0 && budgRows[0].total) totalBudget = Number(budgRows[0].total);
  }
  
  // 4. Get Consumed Budget (sum of all APPROVED financial approvals for this project)
  // This requires an intense join if we strictly check invoices. For now, we will query all approved FAs for the tenant and join where target_id links to this project.
  // We will assume 'invoice' types are costs for the project.
  let consumedBudget = 0;
  const { rows: consRows } = await pool.query(\`
    SELECT SUM(fa.amount) as consumed
    FROM financial_approvals fa
    JOIN invoices i ON fa.target_id = i.id
    WHERE fa.tenant_id = $1 AND fa.status = 'approved' AND i.project_id = $2
  \`, [tenantId, projectId]);
  
  if (consRows.length > 0 && consRows[0].consumed) consumedBudget = Number(consRows[0].consumed);
  
  const requestAmount = Number(app.amount);
  const remainingBudget = totalBudget - consumedBudget;
  const afterApproval = remainingBudget - requestAmount;
  
  let status = 'safe';
  if (afterApproval < 0) status = 'exceeded';
  else if (afterApproval < (totalBudget * 0.1)) status = 'near_limit'; // Less than 10% remaining
  
  return {
    status,
    totalBudget,
    consumedBudget,
    remainingBudget,
    requestAmount,
    afterApproval,
    projectId
  };
}

module.exports = { getProjectBudgetValidation };
`;
fs.writeFileSync(utilFile, utilCode);

const routeFile = path.join(__dirname, 'server/src/routes/financialApprovals.js');
let routeCode = fs.readFileSync(routeFile, 'utf8');

if (!routeCode.includes('getProjectBudgetValidation')) {
  routeCode = `const { getProjectBudgetValidation } = require('../utils/budgetValidator');\n` + routeCode;
}

if (!routeCode.includes('/budget-validation')) {
  const valRoute = `
// GET /api/financial-approvals/:id/budget-validation
router.get('/:id/budget-validation', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const data = await getProjectBudgetValidation(req.params.id, tenantId);
    return success(res, data);
  } catch (err) {
    if (err.message === 'Approval not found') return fail(res, 'NOT_FOUND', err.message, 404);
    next(err);
  }
});
`;
  routeCode = routeCode.replace('module.exports = router;', valRoute + '\nmodule.exports = router;');
}

const approveRegex = /router\.post\('\/:id\/approve', async \(req, res, next\) => \{([\s\S]*?)try \{/;
const newApprove = `router.post('/:id/approve', async (req, res, next) => {$1try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    // Budget Validation Hard-Block
    const validation = await getProjectBudgetValidation(req.params.id, tenantId);
    if (validation.status === 'exceeded' && req.body.force !== true) {
      return fail(res, 'BAD_REQUEST', 'Budget exceeded. Approval blocked.', 400);
    }
`;
routeCode = routeCode.replace(approveRegex, newApprove);

fs.writeFileSync(routeFile, routeCode);
console.log('Backend budget validator patched');
