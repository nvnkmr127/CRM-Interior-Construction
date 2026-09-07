const pool = require('../config/db');

function isUuid(str) {
  return typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
}

async function getProjectBudgetValidation(approvalId, tenantId) {
  try {
    const safeTenantId = tenantId || null;
    if (!isUuid(approvalId)) {
      return { status: 'safe', totalBudget: 0, consumedBudget: 0, remainingBudget: 0, requestAmount: 0, afterApproval: 0, message: 'Invalid approval ID' };
    }
    // 1. Get the approval
    const { rows: appRows } = safeTenantId
      ? await pool.query('SELECT target_id, transaction_type, amount, requested_changes FROM financial_approvals WHERE id = $1 AND tenant_id = $2', [approvalId, safeTenantId])
      : await pool.query('SELECT target_id, transaction_type, amount, requested_changes FROM financial_approvals WHERE id = $1', [approvalId]);
    if (appRows.length === 0) return { status: 'safe', totalBudget: 0, consumedBudget: 0, remainingBudget: 0, requestAmount: 0, afterApproval: 0, message: 'Approval not found' };
    const app = appRows[0];
    
    let projectId = null;
    if (isUuid(app.target_id)) {
      if (app.transaction_type === 'invoice') {
        const { rows: inv } = safeTenantId
          ? await pool.query('SELECT project_id FROM invoices WHERE id = $1 AND tenant_id = $2', [app.target_id, safeTenantId])
          : await pool.query('SELECT project_id FROM invoices WHERE id = $1', [app.target_id]);
        if (inv.length > 0) projectId = inv[0].project_id;
      } else if (['payment', 'payment_update', 'manual_payment', 'Manual Payment'].includes(app.transaction_type)) {
        const { rows: pm } = safeTenantId
          ? await pool.query('SELECT project_id FROM payment_milestones WHERE id = $1 AND tenant_id = $2', [app.target_id, safeTenantId])
          : await pool.query('SELECT project_id FROM payment_milestones WHERE id = $1', [app.target_id]);
        if (pm.length > 0) projectId = pm[0].project_id;
      }
    }

    if (!projectId && app.requested_changes) {
      let changes = app.requested_changes;
      if (typeof changes === 'string') {
        try { changes = JSON.parse(changes); } catch(e) { changes = {}; }
      }
      const pId = changes?.payload?.projectId || changes?.projectId;
      if (isUuid(pId)) projectId = pId;
    }
    
    // Fallback if no project is found
    if (!projectId) {
      return {
        status: 'safe',
        totalBudget: 0,
        consumedBudget: 0,
        remainingBudget: 0,
        requestAmount: Number(app.amount || 0),
        afterApproval: 0,
        message: 'No project linked'
      };
    }
    
    // 3. Get Project Contract Value & Budgets
    let totalBudget = 0;
    const { rows: projRows } = safeTenantId
      ? await pool.query('SELECT contract_value FROM projects WHERE id = $1 AND tenant_id = $2', [projectId, safeTenantId])
      : await pool.query('SELECT contract_value FROM projects WHERE id = $1', [projectId]);
    if (projRows.length > 0 && projRows[0].contract_value) {
      totalBudget = Number(projRows[0].contract_value);
    } else {
      const { rows: budgRows } = safeTenantId
        ? await pool.query('SELECT SUM(budgeted_cost) as total FROM project_budgets WHERE project_id = $1 AND tenant_id = $2', [projectId, safeTenantId])
        : await pool.query('SELECT SUM(budgeted_cost) as total FROM project_budgets WHERE project_id = $1', [projectId]);
      if (budgRows.length > 0 && budgRows[0].total) totalBudget = Number(budgRows[0].total);
    }
    
    // 4. Get Consumed Budget
    let consumedBudget = 0;
    const { rows: consRows } = safeTenantId
      ? await pool.query(`
          SELECT SUM(fa.amount) as consumed
          FROM financial_approvals fa
          JOIN invoices i ON fa.target_id = i.id
          WHERE fa.tenant_id = $1 AND fa.status = 'approved' AND i.project_id = $2
        `, [safeTenantId, projectId])
      : await pool.query(`
          SELECT SUM(fa.amount) as consumed
          FROM financial_approvals fa
          JOIN invoices i ON fa.target_id = i.id
          WHERE fa.status = 'approved' AND i.project_id = $1
        `, [projectId]);
    
    if (consRows.length > 0 && consRows[0].consumed) consumedBudget = Number(consRows[0].consumed);
    
    const requestAmount = Number(app.amount || 0);
    const remainingBudget = totalBudget - consumedBudget;
    const afterApproval = remainingBudget - requestAmount;
    
    let status = 'safe';
    if (afterApproval < 0) status = 'exceeded';
    else if (totalBudget > 0 && afterApproval < (totalBudget * 0.1)) status = 'near_limit';
    
    return {
      status,
      totalBudget,
      consumedBudget,
      remainingBudget,
      requestAmount,
      afterApproval,
      projectId
    };
  } catch (err) {
    return { status: 'safe', totalBudget: 0, consumedBudget: 0, remainingBudget: 0, requestAmount: 0, afterApproval: 0, message: err.message };
  }
}

module.exports = { getProjectBudgetValidation };
