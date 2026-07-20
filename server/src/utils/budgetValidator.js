
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
  const { rows: consRows } = await pool.query(`
    SELECT SUM(fa.amount) as consumed
    FROM financial_approvals fa
    JOIN invoices i ON fa.target_id = i.id
    WHERE fa.tenant_id = $1 AND fa.status = 'approved' AND i.project_id = $2
  `, [tenantId, projectId]);
  
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
