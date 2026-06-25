const pool = require('../../db/pool');
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

async function createPaymentMilestone({ tenantId, userId, data }) {
  const { projectId, name, amount, percentage, dueDate, milestoneId, notes } = data;
  
  const query = `
    INSERT INTO payment_milestones (tenant_id, project_id, name, amount, percentage, due_date, milestone_id, notes, status)
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'scheduled')
    RETURNING *
  `;
  const values = [tenantId, projectId, name, amount || null, percentage || null, dueDate || null, milestoneId || null, notes || null];
  
  const result = await pool.query(query, values);
  const milestone = result.rows[0];

  await logAction({
    tenantId,
    userId,
    action: 'create_payment_milestone',
    entity: 'payment_milestone',
    entityId: milestone.id,
    newValue: { name, amount, percentage, dueDate }
  });

  return milestone;
}

async function updatePaymentMilestone({ tenantId, userId, milestoneId, data }) {
  const { status, invoice_reference, paid_at, paid_amount } = data;

  // Retrieve current to check transition
  const currentResult = await pool.query(`SELECT * FROM payment_milestones WHERE id = $1 AND tenant_id = $2`, [milestoneId, tenantId]);
  if (currentResult.rowCount === 0) throw new Error('NOT_FOUND');
  const current = currentResult.rows[0];

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

  if (updateFields.length === 0) return current;

  const tenantIdx = paramIdx++;
  const idIdx = paramIdx++;
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
