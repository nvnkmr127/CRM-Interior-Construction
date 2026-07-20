
const pool = require('../config/db');
const { getProjectBudgetValidation } = require('./budgetValidator');

async function analyzeFinancialRisk(approvalId, tenantId) {
  // 1. Fetch the transaction
  const { rows } = await pool.query('SELECT target_id, transaction_type, amount, status FROM financial_approvals WHERE id = $1 AND tenant_id = $2', [approvalId, tenantId]);
  if (rows.length === 0) throw new Error('Approval not found');
  const app = rows[0];
  
  let riskScore = 0;
  const reasons = [];
  
  const amt = Number(app.amount);
  
  // 2. Duplicate Detection (Same target_id, same transaction_type, same amount, within last 30 days, NOT this exact ID)
  const { rows: dupes } = await pool.query(`
    SELECT id FROM financial_approvals 
    WHERE tenant_id = $1 AND target_id = $2 AND transaction_type = $3 AND amount = $4 AND id != $5
    AND created_at > NOW() - INTERVAL '30 days'
  `, [tenantId, app.target_id, app.transaction_type, app.amount, approvalId]);
  
  if (dupes.length > 0) {
    if (app.transaction_type === 'invoice') {
      riskScore += 50;
      reasons.push('Duplicate Invoice Detected (Same amount and target)');
    } else if (app.transaction_type.includes('payment')) {
      riskScore += 50;
      reasons.push('Duplicate Payment Detected');
    } else if (app.transaction_type.includes('refund')) {
      riskScore += 60;
      reasons.push('Repeated Refund Detected');
    }
  }
  
  // 3. Large Discount / Refund Check
  if (app.transaction_type.includes('discount') && amt > 5000) {
    riskScore += 30;
    reasons.push('Large Discount (>$5,000)');
  }
  if (app.transaction_type.includes('refund') && amt > 10000) {
    riskScore += 40;
    reasons.push('Large Refund (>$10,000)');
  }
  
  // 4. Budget Overrun & Project Loss Risk
  try {
    const budgetData = await getProjectBudgetValidation(approvalId, tenantId);
    if (budgetData.status === 'exceeded') {
      riskScore += 80;
      reasons.push('Budget Overrun (Exceeds Total Project Budget)');
    } else if (budgetData.status === 'near_limit') {
      riskScore += 30;
      reasons.push('Near Budget Limit (<10% Remaining)');
    }
    
    // Project Loss Risk
    if (budgetData.totalBudget > 0 && budgetData.afterApproval < -(budgetData.totalBudget * 0.1)) {
      riskScore += 40; // additive
      reasons.push('Project Loss Risk (Negative Margin > 10%)');
    }
  } catch (err) {
    // ignore if no project
  }
  
  // 5. Vendor Risk (If invoice, check project_vendors for default_date)
  if (app.transaction_type === 'invoice' && app.target_id) {
    try {
      const { rows: inv } = await pool.query('SELECT project_id, vendor_id FROM invoices WHERE id = $1', [app.target_id]);
      if (inv.length > 0 && inv[0].project_id && inv[0].vendor_id) {
        const { rows: ven } = await pool.query('SELECT default_date FROM project_vendors WHERE project_id = $1 AND vendor_id = $2', [inv[0].project_id, inv[0].vendor_id]);
        if (ven.length > 0 && ven[0].default_date) {
          riskScore += 50;
          reasons.push('High Vendor Risk (Previous Default Detected on Project)');
        }
      }
    } catch(err){}
  }
  
  // Cap at 100
  riskScore = Math.min(100, riskScore);
  
  // 6. Output mapping
  let badge = 'low';
  let recommendation = 'Proceed with standard approval process.';
  
  if (riskScore >= 70) {
    badge = 'high';
    recommendation = 'Reject and request clarification immediately.';
  } else if (riskScore >= 30) {
    badge = 'medium';
    recommendation = 'Approve with caution. Verify documentation.';
  }
  
  if (riskScore === 0) {
    reasons.push('No anomalies detected.');
  }

  return {
    riskScore,
    badge,
    reasons,
    recommendation
  };
}

module.exports = { analyzeFinancialRisk };
