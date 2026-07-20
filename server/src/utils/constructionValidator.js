
const pool = require('../config/db');
const { getProjectBudgetValidation } = require('./budgetValidator');

async function getConstructionFinancialSummary(approvalId, tenantId) {
  // 1. Fetch the transaction
  const { rows } = await pool.query('SELECT target_id, transaction_type, amount FROM financial_approvals WHERE id = $1 AND tenant_id = $2', [approvalId, tenantId]);
  if (rows.length === 0) throw new Error('Approval not found');
  const app = rows[0];

  // Try to find Project ID and Bill Type
  let projectId = null;
  let vendorBill = null;

  if (app.transaction_type === 'vendor_bill' || app.transaction_type === 'invoice') {
    try {
      const { rows: vb } = await pool.query('SELECT * FROM vendor_bills WHERE id = $1', [app.target_id]);
      if (vb.length > 0) {
        projectId = vb[0].project_id;
        vendorBill = vb[0];
      } else {
        const { rows: inv } = await pool.query('SELECT * FROM invoices WHERE id = $1', [app.target_id]);
        if (inv.length > 0) {
          projectId = inv[0].project_id;
          vendorBill = { ...inv[0], base_amount: inv[0].amount, net_payable: inv[0].amount }; // Map old invoice format
        }
      }
    } catch(err){}
  } else if (app.transaction_type === 'payment' || app.transaction_type === 'payment_update') {
    try {
      const { rows: pm } = await pool.query('SELECT project_id FROM payment_milestones WHERE id = $1', [app.target_id]);
      if (pm.length > 0) projectId = pm[0].project_id;
    } catch(err){}
  } else if (app.transaction_type === 'site_expense') {
    try {
      const { rows: se } = await pool.query('SELECT project_id FROM site_expenses WHERE id = $1', [app.target_id]);
      if (se.length > 0) projectId = se[0].project_id;
    } catch(err){}
  }

  const summary = {
    projectId,
    totalBoq: 0,
    totalPOs: 0,
    totalWOs: 0,
    totalSiteExpenses: 0,
    totalMilestones: 0,
    totalMaterialRequests: 0,
    totalAdvances: 0,
    validationFlags: []
  };

  if (!projectId) {
    summary.validationFlags.push({ type: 'warning', message: 'No project linked to this transaction.' });
    return summary;
  }

  // 2. Fetch Aggregates (Wrap in try/catch since schema might be partially migrated)
  try {
    const { rows: boq } = await pool.query('SELECT SUM(total_amount) as total FROM boqs WHERE project_id = $1', [projectId]);
    summary.totalBoq = Number(boq[0]?.total || 0);
  } catch(err){}
  try {
    const { rows: po } = await pool.query('SELECT SUM(total_amount) as total FROM purchase_orders WHERE project_id = $1', [projectId]);
    summary.totalPOs = Number(po[0]?.total || 0);
  } catch(err){}
  try {
    const { rows: wo } = await pool.query('SELECT SUM(total_amount) as total FROM work_orders WHERE project_id = $1', [projectId]);
    summary.totalWOs = Number(wo[0]?.total || 0);
  } catch(err){}
  try {
    const { rows: se } = await pool.query('SELECT SUM(amount) as total FROM site_expenses WHERE project_id = $1', [projectId]);
    summary.totalSiteExpenses = Number(se[0]?.total || 0);
  } catch(err){}
  try {
    const { rows: pm } = await pool.query('SELECT SUM(amount) as total FROM payment_milestones WHERE project_id = $1', [projectId]);
    summary.totalMilestones = Number(pm[0]?.total || 0);
  } catch(err){}

  
  try {
    const { rows: mr } = await pool.query('SELECT SUM(estimated_cost) as total FROM material_requests WHERE project_id = $1', [projectId]);
    summary.totalMaterialRequests = Number(mr[0]?.total || 0);
  } catch(err){}
  try {
    const { rows: adv } = await pool.query("SELECT SUM(amount) as total FROM site_expenses WHERE project_id = $1 AND expense_type = 'labour_advance'", [projectId]);
    summary.totalAdvances = Number(adv[0]?.total || 0);
  } catch(err){}
  

  // 3. Mathematical Validation Engine (GST, TDS, Retention)
  if (vendorBill) {
    // GST Validation
    const base = Number(vendorBill.base_amount || 0);
    const rate = Number(vendorBill.gst_rate || 0);
    const cgst = Number(vendorBill.cgst_amount || 0);
    const sgst = Number(vendorBill.sgst_amount || 0);
    const igst = Number(vendorBill.igst_amount || 0);
    
    if (base > 0 && rate > 0) {
      const expectedGst = (base * rate) / 100;
      const actualGst = cgst + sgst + igst;
      // Allow 1 rupee rounding margin
      if (Math.abs(expectedGst - actualGst) > 1.0) {
        summary.validationFlags.push({ type: 'error', message: `GST Mismatch: Expected ${expectedGst.toFixed(2)}, Found ${actualGst.toFixed(2)}` });
      } else {
        summary.validationFlags.push({ type: 'success', message: 'GST Math Validated' });
      }
    }

    // TDS Validation
    const tdsRate = Number(vendorBill.tds_rate || 0);
    const tdsAmt = Number(vendorBill.tds_amount || 0);
    if (base > 0 && tdsRate > 0) {
      const expectedTds = (base * tdsRate) / 100;
      if (Math.abs(expectedTds - tdsAmt) > 1.0) {
        summary.validationFlags.push({ type: 'error', message: `TDS Mismatch: Expected ${expectedTds.toFixed(2)}, Found ${tdsAmt.toFixed(2)}` });
      } else {
        summary.validationFlags.push({ type: 'success', message: 'TDS Withholding Validated' });
      }
    }

    // Retention Validation (Assume standard 5% rule for contractor bills)
    if (vendorBill.bill_type === 'contractor') {
      const retAmt = Number(vendorBill.retention_amount || 0);
      const expectedRet = (base * 5) / 100;
      if (retAmt < expectedRet - 1.0) {
        summary.validationFlags.push({ type: 'error', message: `Retention Bypass: Required 5% (${expectedRet.toFixed(2)}), Found ${retAmt.toFixed(2)}` });
      } else {
        summary.validationFlags.push({ type: 'success', message: 'Retention Rules Compliant' });
      }
    }
  }

  // General Budget Cross-check
  try {
    const budgetData = await getProjectBudgetValidation(approvalId, tenantId);
    if (budgetData.status === 'exceeded') {
      summary.validationFlags.push({ type: 'error', message: 'Project Budget Exceeded' });
    }
  } catch(err){}

  return summary;
}

module.exports = { getConstructionFinancialSummary };
