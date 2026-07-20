const pool = require('../../db/pool');
const { getTenantThreshold, isUserSuperadmin } = require('../../utils/finance');
const { logAction } = require('../auditLog');
const { buildApprovalChain } = require('../../utils/ApprovalChainBuilder');

async function getCreditNotes(tenantId, projectId) {
  const query = `
    SELECT cn.*, inv.invoice_number as linked_invoice_number
    FROM credit_notes cn
    LEFT JOIN invoices inv ON cn.invoice_id = inv.id
    WHERE cn.tenant_id = $1 AND cn.project_id = $2
    ORDER BY cn.credit_note_date DESC, cn.created_at DESC
  `;
  const result = await pool.query(query, [tenantId, projectId]);
  return result.rows;
}

async function getRefunds(tenantId, projectId) {
  const query = `
    SELECT r.*, pm.name as linked_milestone_name
    FROM refunds r
    LEFT JOIN payment_milestones pm ON r.payment_milestone_id = pm.id
    WHERE r.tenant_id = $1 AND r.project_id = $2
    ORDER BY r.refund_date DESC, r.created_at DESC
  `;
  const result = await pool.query(query, [tenantId, projectId]);
  return result.rows;
}

async function generateCreditNoteNumber(tenantId) {
  const year = new Date().getFullYear();
  const pattern = `CN-${year}-%`;
  
  const query = `
    SELECT credit_note_number FROM credit_notes 
    WHERE tenant_id = $1 AND credit_note_number LIKE $2 
    ORDER BY credit_note_number DESC LIMIT 1
  `;
  const result = await pool.query(query, [tenantId, pattern]);
  
  let nextSeq = 1;
  if (result.rows.length > 0) {
    const lastNum = result.rows[0].credit_note_number;
    const parts = lastNum.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }
  
  return `CN-${year}-${String(nextSeq).padStart(4, '0')}`;
}

async function generateRefundNumber(tenantId) {
  const year = new Date().getFullYear();
  const pattern = `REF-${year}-%`;
  
  const query = `
    SELECT refund_number FROM refunds 
    WHERE tenant_id = $1 AND refund_number LIKE $2 
    ORDER BY refund_number DESC LIMIT 1
  `;
  const result = await pool.query(query, [tenantId, pattern]);
  
  let nextSeq = 1;
  if (result.rows.length > 0) {
    const lastNum = result.rows[0].refund_number;
    const parts = lastNum.split('-');
    const lastSeq = parseInt(parts[parts.length - 1], 10);
    if (!isNaN(lastSeq)) {
      nextSeq = lastSeq + 1;
    }
  }
  
  return `REF-${year}-${String(nextSeq).padStart(4, '0')}`;
}

async function createCreditNote({ tenantId, userId, data, bypassApproval = false }) {
  const { projectId, invoiceId, subtotal, gstType, gstRate, reason, notes, creditNoteDate } = data;
  
  // Calculate tax components
  const amount = Number(subtotal || 0);
  const rate = Number(gstRate !== undefined ? gstRate : 18.00);
  const type = gstType || 'cgst_sgst';
  
  let cgst = 0;
  let sgst = 0;
  let igst = 0;

  if (type === 'cgst_sgst') {
    cgst = Number(((amount * (rate / 2)) / 100).toFixed(2));
    sgst = Number(((amount * (rate / 2)) / 100).toFixed(2));
  } else {
    igst = Number(((amount * rate) / 100).toFixed(2));
  }
  
  const totalAmount = Number((amount + cgst + sgst + igst).toFixed(2));
  const creditNoteNumber = await generateCreditNoteNumber(tenantId);
  const cnDate = creditNoteDate || new Date().toISOString().split('T')[0];

  const threshold = await getTenantThreshold(tenantId, 'finance_credit_threshold', 50000.00);
  const isSuperadmin = await isUserSuperadmin(userId);
  const requiresApproval = !bypassApproval && !isSuperadmin && totalAmount > threshold;
  const initialStatus = requiresApproval ? 'pending_approval' : 'issued';

  const query = `
    INSERT INTO credit_notes (
      tenant_id, project_id, invoice_id, credit_note_number, credit_note_date,
      subtotal, gst_type, gst_rate, cgst_amount, sgst_amount, igst_amount, total_amount,
      reason, notes, status, created_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16
    ) RETURNING *
  `;
  const values = [
    tenantId, projectId, invoiceId || null, creditNoteNumber, cnDate,
    amount, type, rate, cgst, sgst, igst, totalAmount,
    reason, notes || null, initialStatus, userId
  ];

  const result = await pool.query(query, values);
  const creditNote = result.rows[0];

  if (requiresApproval) {
    const { current_stage, total_stages, approval_chain } = await buildApprovalChain(tenantId, 'credit', totalAmount);
    await pool.query(
      `INSERT INTO financial_approvals (
         tenant_id, transaction_type, target_id, amount, requested_by, requested_changes, status, threshold_limit,
         current_stage, total_stages, approval_chain
       ) VALUES ($1, 'credit', $2, $3, $4, $5, 'pending', $6, $7, $8, $9)`,
      [tenantId, creditNote.id, totalAmount, userId, JSON.stringify({ type: 'credit' }), threshold, current_stage, total_stages, JSON.stringify(approval_chain)]
    );
  }

  await logAction({
    tenantId,
    userId,
    action: 'create_credit_note',
    entity: 'credit_note',
    entityId: creditNote.id,
    newValue: { creditNoteNumber, projectId, totalAmount, requiresApproval }
  });

  return creditNote;
}

async function createRefund({ tenantId, userId, data, bypassApproval = false }) {
  const { projectId, paymentMilestoneId, amount, paymentMethod, referenceNumber, reason, notes, refundDate } = data;
  
  const refundNumber = await generateRefundNumber(tenantId);
  const refDate = refundDate || new Date().toISOString().split('T')[0];

  const threshold = await getTenantThreshold(tenantId, 'finance_credit_threshold', 50000.00);
  const isSuperadmin = await isUserSuperadmin(userId);
  const requiresApproval = !bypassApproval && !isSuperadmin && amount > threshold;
  const initialStatus = requiresApproval ? 'pending_approval' : 'processed';

  const query = `
    INSERT INTO refunds (
      tenant_id, project_id, payment_milestone_id, refund_number, refund_date,
      amount, payment_method, reference_number, reason, notes, status, created_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
    ) RETURNING *
  `;
  const values = [
    tenantId, projectId, paymentMilestoneId || null, refundNumber, refDate,
    amount, paymentMethod || 'Bank Transfer', referenceNumber || null, reason, notes || null, initialStatus, userId
  ];

  const result = await pool.query(query, values);
  const refund = result.rows[0];

  if (requiresApproval) {
    const { current_stage, total_stages, approval_chain } = await buildApprovalChain(tenantId, 'refund', amount);
    await pool.query(
      `INSERT INTO financial_approvals (
         tenant_id, transaction_type, target_id, amount, requested_by, requested_changes, status, threshold_limit,
         current_stage, total_stages, approval_chain
       ) VALUES ($1, 'refund', $2, $3, $4, $5, 'pending', $6, $7, $8, $9)`,
      [tenantId, refund.id, amount, userId, JSON.stringify({ type: 'refund' }), threshold, current_stage, total_stages, JSON.stringify(approval_chain)]
    );
  }

  await logAction({
    tenantId,
    userId,
    action: 'create_refund',
    entity: 'refund',
    entityId: refund.id,
    newValue: { refundNumber, projectId, amount, requiresApproval }
  });

  return refund;
}

module.exports = {
  getCreditNotes,
  getRefunds,
  createCreditNote,
  createRefund
};
