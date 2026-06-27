const express = require('express');
const pool = require('../db/pool');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');
const paymentService = require('../services/projects/paymentMilestoneService');
const quotationService = require('../services/projects/quotationService');

const router = express.Router();
router.use(authenticate);

// Helper to check specific finance permissions
function checkPermissionForType(user, type) {
  if (user.role === 'superadmin') return true;
  const perms = user.permissions || [];
  
  if (type === 'invoice') return perms.includes('finance:invoices');
  if (type === 'payment' || type === 'payment_update') return perms.includes('finance:payments');
  if (type === 'discount') return perms.includes('finance:discounts');
  if (type === 'credit' || type === 'refund') return perms.includes('finance:credits');
  return false;
}

// GET /api/financial-approvals
router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const query = `
      SELECT fa.*, u.name as requester_name, p.name as project_name,
             CASE 
               WHEN fa.transaction_type = 'invoice' THEN (SELECT invoice_number FROM invoices WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'payment' THEN (SELECT name FROM payment_milestones WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'payment_update' THEN (SELECT name FROM payment_milestones WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'discount' THEN (SELECT quotation_number FROM quotations WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'credit' THEN (SELECT credit_note_number FROM credit_notes WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'refund' THEN (SELECT refund_number FROM refunds WHERE id = fa.target_id)
             END as target_number,
             CASE
               WHEN fa.transaction_type = 'invoice' THEN (SELECT project_id FROM invoices WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'payment' THEN (SELECT project_id FROM payment_milestones WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'payment_update' THEN (SELECT project_id FROM payment_milestones WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'discount' THEN (SELECT project_id FROM quotations WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'credit' THEN (SELECT project_id FROM credit_notes WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'refund' THEN (SELECT project_id FROM refunds WHERE id = fa.target_id)
             END as project_id
      FROM financial_approvals fa
      LEFT JOIN users u ON fa.requested_by = u.id
      LEFT JOIN projects p ON p.id = (
             CASE
               WHEN fa.transaction_type = 'invoice' THEN (SELECT project_id FROM invoices WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'payment' THEN (SELECT project_id FROM payment_milestones WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'payment_update' THEN (SELECT project_id FROM payment_milestones WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'discount' THEN (SELECT project_id FROM quotations WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'credit' THEN (SELECT project_id FROM credit_notes WHERE id = fa.target_id)
               WHEN fa.transaction_type = 'refund' THEN (SELECT project_id FROM refunds WHERE id = fa.target_id)
             END
      )
      WHERE fa.tenant_id = $1
      ORDER BY fa.created_at DESC
    `;

    const { rows } = await pool.query(query, [tenantId]);
    return success(res, rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/financial-approvals/:id/approve
router.post('/:id/approve', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const tenantId = req.tenantId;
    const userId = req.user.id || req.user.userId;
    const { id } = req.params;

    await client.query('BEGIN');

    // 1. Fetch approval record
    const { rows } = await client.query(
      `SELECT * FROM financial_approvals WHERE id = $1 AND tenant_id = $2 AND status = 'pending'`,
      [id, tenantId]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return fail(res, 'NOT_FOUND', 'Pending approval request not found', 404);
    }
    const approval = rows[0];

    // 2. Authorize based on type
    if (!checkPermissionForType(req.user, approval.transaction_type)) {
      await client.query('ROLLBACK');
      return fail(res, 'FORBIDDEN', `Forbidden: require finance permission for ${approval.transaction_type}`, 403);
    }

    // 3. Mark approved
    await client.query(
      `UPDATE financial_approvals 
       SET status = 'approved', approved_by = $1, approved_at = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
       WHERE id = $2`,
      [userId, id]
    );

    // 4. Apply changes based on transaction type
    if (approval.transaction_type === 'invoice') {
      const changes = typeof approval.requested_changes === 'string' ? JSON.parse(approval.requested_changes) : approval.requested_changes;
      const { milestoneId, invoiceNumber } = changes;
      
      // Update invoice status to sent
      await client.query(
        `UPDATE invoices SET status = 'sent', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [approval.target_id]
      );
      
      // Update payment milestone status and reference
      await client.query(
        `UPDATE payment_milestones 
         SET invoice_reference = $1, status = 'invoice_raised' 
         WHERE id = $2 AND tenant_id = $3`,
        [invoiceNumber, milestoneId, tenantId]
      );
    } 
    else if (approval.transaction_type === 'payment') {
      // Update new payment milestone status to scheduled
      await client.query(
        `UPDATE payment_milestones SET status = 'scheduled' WHERE id = $1 AND tenant_id = $2`,
        [approval.target_id, tenantId]
      );
    } 
    else if (approval.transaction_type === 'payment_update') {
      const changes = typeof approval.requested_changes === 'string' ? JSON.parse(approval.requested_changes) : approval.requested_changes;
      // Call update internal logic bypassing approval check
      await paymentService.updatePaymentMilestone({
        tenantId,
        userId,
        milestoneId: approval.target_id,
        data: changes.data,
        bypassApproval: true
      });
    } 
    else if (approval.transaction_type === 'discount') {
      const changes = typeof approval.requested_changes === 'string' ? JSON.parse(approval.requested_changes) : approval.requested_changes;
      // Call update internal logic bypassing approval check
      await quotationService.updateQuotation(
        tenantId,
        approval.target_id,
        { discountAmount: changes.discountAmount },
        userId,
        true
      );
    } 
    else if (approval.transaction_type === 'credit') {
      // Update credit note status to issued
      await client.query(
        `UPDATE credit_notes SET status = 'issued', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [approval.target_id]
      );
    } 
    else if (approval.transaction_type === 'refund') {
      // Update refund status to processed
      await client.query(
        `UPDATE refunds SET status = 'processed', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [approval.target_id]
      );
    }

    await client.query('COMMIT');
    return success(res, { message: 'Approval request approved successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// POST /api/financial-approvals/:id/reject
router.post('/:id/reject', async (req, res, next) => {
  const client = await pool.connect();
  try {
    const tenantId = req.tenantId;
    const userId = req.user.id || req.user.userId;
    const { id } = req.params;
    const { rejectionReason } = req.body;

    if (!rejectionReason || rejectionReason.trim() === '') {
      return fail(res, 'BAD_REQUEST', 'Rejection reason is required', 400);
    }

    await client.query('BEGIN');

    // 1. Fetch approval record
    const { rows } = await client.query(
      `SELECT * FROM financial_approvals WHERE id = $1 AND tenant_id = $2 AND status = 'pending'`,
      [id, tenantId]
    );
    if (rows.length === 0) {
      await client.query('ROLLBACK');
      return fail(res, 'NOT_FOUND', 'Pending approval request not found', 404);
    }
    const approval = rows[0];

    // 2. Authorize based on type
    if (!checkPermissionForType(req.user, approval.transaction_type)) {
      await client.query('ROLLBACK');
      return fail(res, 'FORBIDDEN', `Forbidden: require finance permission for ${approval.transaction_type}`, 403);
    }

    // 3. Mark rejected
    await client.query(
      `UPDATE financial_approvals 
       SET status = 'rejected', approved_by = $1, approved_at = CURRENT_TIMESTAMP, rejection_reason = $2, updated_at = CURRENT_TIMESTAMP
       WHERE id = $3`,
      [userId, rejectionReason, id]
    );

    // 4. Apply rejection (revert status or delete/void)
    if (approval.transaction_type === 'invoice') {
      // Set status to void
      await client.query(
        `UPDATE invoices SET status = 'void', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [approval.target_id]
      );
    } 
    else if (approval.transaction_type === 'payment') {
      // Delete the payment milestone entirely since it was pending creation
      await client.query(
        `DELETE FROM payment_milestones WHERE id = $1 AND tenant_id = $2`,
        [approval.target_id, tenantId]
      );
    } 
    else if (approval.transaction_type === 'payment_update') {
      const changes = typeof approval.requested_changes === 'string' ? JSON.parse(approval.requested_changes) : approval.requested_changes;
      // Revert status to original status before update attempt
      await client.query(
        `UPDATE payment_milestones SET status = $1 WHERE id = $2 AND tenant_id = $3`,
        [changes.original_status, approval.target_id, tenantId]
      );
    } 
    else if (approval.transaction_type === 'credit') {
      // Set status to void
      await client.query(
        `UPDATE credit_notes SET status = 'void', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [approval.target_id]
      );
    } 
    else if (approval.transaction_type === 'refund') {
      // Set status to void
      await client.query(
        `UPDATE refunds SET status = 'void', updated_at = CURRENT_TIMESTAMP WHERE id = $1`,
        [approval.target_id]
      );
    }

    await client.query('COMMIT');
    return success(res, { message: 'Approval request rejected successfully' });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

module.exports = router;
