const pool = require('../../db/pool');
const { getTenantThreshold, isUserSuperadmin } = require('../../utils/finance');
const { buildApprovalChain } = require('../../utils/ApprovalChainBuilder');
const { logAction } = require('../auditLog');

async function getPaymentMilestones({ tenantId, projectId }) {
  const query = `
    SELECT pm.*, m.name as linked_milestone_name
    FROM payment_milestones pm
    LEFT JOIN milestones m ON pm.milestone_id = m.id
    WHERE pm.tenant_id = $1 AND pm.project_id = $2
    ORDER BY pm.due_date ASC, pm.created_at ASC
  `;
  const result = await pool.query(query, [tenantId, projectId]);
  return result.rows;
}

async function createPaymentMilestone({ tenantId, userId, data, bypassApproval = false }) {
  const { projectId, name, amount, percentage, dueDate, milestoneId, notes, tdsRate, tdsAmount } = data;
  
  const threshold = await getTenantThreshold(tenantId, 'finance_payment_threshold', 100000.00);
  const isSuperadmin = await isUserSuperadmin(userId);
  const requiresApproval = !bypassApproval && !isSuperadmin && amount && amount > threshold;
  const initialStatus = requiresApproval ? 'pending_approval' : 'scheduled';

  const query = `
    INSERT INTO payment_milestones (tenant_id, project_id, name, amount, percentage, due_date, milestone_id, notes, status, tds_rate, tds_amount)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    RETURNING *
  `;
  const values = [tenantId, projectId, name, amount || null, percentage || null, dueDate || null, milestoneId || null, notes || null, initialStatus, tdsRate || 0.00, tdsAmount || 0.00];
  
  const result = await pool.query(query, values);
  const milestone = result.rows[0];

  if (requiresApproval) {
    const { current_stage, total_stages, approval_chain } = await buildApprovalChain(tenantId, 'payment', amount);
    await pool.query(
      `INSERT INTO financial_approvals (
         tenant_id, transaction_type, target_id, amount, requested_by, requested_changes, status, threshold_limit,
         current_stage, total_stages, approval_chain
       ) VALUES ($1, 'payment', $2, $3, $4, $5, 'pending', $6, $7, $8, $9)`,
      [tenantId, milestone.id, amount, userId, JSON.stringify({ type: 'create', data }), threshold, current_stage, total_stages, JSON.stringify(approval_chain)]
    );
  }

  await logAction({
    tenantId,
    userId,
    action: 'create_payment_milestone',
    entity: 'payment_milestone',
    entityId: milestone.id,
    newValue: { name, amount, percentage, dueDate, tdsRate, tdsAmount, requiresApproval }
  });

  return milestone;
}

async function updatePaymentMilestone({ tenantId, userId, milestoneId, data, bypassApproval = false }) {
  const { status, invoice_reference, paid_at, paid_amount, tds_rate, tds_amount, is_deferred, deferral_reference } = data;

  // Retrieve current to check transition
  const currentResult = await pool.query(`SELECT * FROM payment_milestones WHERE id = $1 AND tenant_id = $2`, [milestoneId, tenantId]);
  if (currentResult.rowCount === 0) throw new Error('NOT_FOUND');
  const current = currentResult.rows[0];

  const threshold = await getTenantThreshold(tenantId, 'finance_payment_threshold', 100000.00);
  const isSuperadmin = await isUserSuperadmin(userId);
  const targetAmount = paid_amount !== undefined ? paid_amount : (current.amount || 0);
  const isUpdatingPaidAmount = paid_amount !== undefined && Number(paid_amount) !== Number(current.paid_amount);
  const isMarkingPaid = status === 'paid' && current.status !== 'paid';

  const requiresApproval = !bypassApproval && !isSuperadmin && (
    (isUpdatingPaidAmount && Number(paid_amount) > threshold) ||
    (isMarkingPaid && Number(targetAmount) > threshold)
  );

  if (requiresApproval) {
    // Keep it as pending_approval but do not apply the updates yet
    const updateRes = await pool.query(
      `UPDATE payment_milestones SET status = 'pending_approval' WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [milestoneId, tenantId]
    );
    const updated = updateRes.rows[0];

    const { current_stage, total_stages, approval_chain } = await buildApprovalChain(tenantId, 'payment_update', targetAmount);
    await pool.query(
      `INSERT INTO financial_approvals (
         tenant_id, transaction_type, target_id, amount, requested_by, requested_changes, status, threshold_limit,
         current_stage, total_stages, approval_chain
       ) VALUES ($1, 'payment_update', $2, $3, $4, $5, 'pending', $6, $7, $8, $9)`,
      [tenantId, milestoneId, targetAmount, userId, JSON.stringify({ type: 'update', original_status: current.status, data }), threshold, current_stage, total_stages, JSON.stringify(approval_chain)]
    );

    await logAction({
      tenantId,
      userId,
      action: 'update_payment_milestone',
      entity: 'payment_milestone',
      entityId: milestoneId,
      newValue: { status: 'pending_approval' },
      oldValue: current
    });

    return updated;
  }

  let updateFields = [];
  let values = [];
  let paramIdx = 1;

  if (status) {
    updateFields.push(`status = $${paramIdx++}`);
    values.push(status);
  }
  if (invoice_reference !== undefined) {
    updateFields.push(`invoice_reference = $${paramIdx++}`);
    values.push(invoice_reference);
  }
  if (paid_at !== undefined) {
    updateFields.push(`paid_at = $${paramIdx++}`);
    values.push(paid_at);
  }
  if (paid_amount !== undefined) {
    updateFields.push(`paid_amount = $${paramIdx++}`);
    values.push(paid_amount);
  }
  if (tds_rate !== undefined) {
    updateFields.push(`tds_rate = $${paramIdx++}`);
    values.push(tds_rate);
  }
  if (tds_amount !== undefined) {
    updateFields.push(`tds_amount = $${paramIdx++}`);
    values.push(tds_amount);
  }
  if (is_deferred !== undefined) {
    updateFields.push(`is_deferred = $${paramIdx++}`);
    values.push(is_deferred);
  }
  if (deferral_reference !== undefined) {
    updateFields.push(`deferral_reference = $${paramIdx++}`);
    values.push(deferral_reference);
  }

  if (updateFields.length === 0) return current;

  const tenantIdx = paramIdx++;
  const idIdx = paramIdx;
  values.push(tenantId, milestoneId);
  const updateQuery = `
    UPDATE payment_milestones
    SET ${updateFields.join(', ')}
    WHERE tenant_id = $${tenantIdx} AND id = $${idIdx}
    RETURNING *
  `;

  const result = await pool.query(updateQuery, values);
  const updated = result.rows[0];

  // Auto-activate project on booking advance payment confirmation
  if (status === 'paid' && current.status !== 'paid' && current.name === 'Booking Advance') {
    const projCheck = await pool.query(
      "SELECT id, status FROM projects WHERE id = $1 AND tenant_id = $2",
      [current.project_id, tenantId]
    );
    if (projCheck.rows.length > 0 && projCheck.rows[0].status === 'pending_payment') {
      await pool.query(
        "UPDATE projects SET status = 'active', updated_at = NOW() WHERE id = $1",
        [current.project_id]
      );
      
      // Log audit action for project status change
      await logAction({
        tenantId,
        userId,
        action: 'project.updated',
        entity: 'project',
        entityId: current.project_id,
        oldValue: { status: 'pending_payment' },
        newValue: { status: 'active' }
      });
    }
  }

  await logAction({
    tenantId,
    userId,
    action: 'update_payment_milestone',
    entity: 'payment_milestone',
    entityId: milestoneId,
    newValue: data,
    oldValue: current
  });

  return updated;
}

module.exports = {
  getPaymentMilestones,
  createPaymentMilestone,
  updatePaymentMilestone
};
