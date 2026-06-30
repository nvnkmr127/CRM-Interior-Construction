const pool = require('../../db/pool');
const { logAction } = require('../auditLog');

/**
 * Creates a new warranty claim.
 */
async function createClaim({
  tenantId,
  projectId,
  warrantyId = null,
  amcId = null,
  claimNumber,
  claimDate = new Date().toISOString().split('T')[0],
  natureOfDefect,
  userId = null
}) {
  let isRepeat = false;
  let repeatCount = 0;
  
  if (warrantyId) {
    const countRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM warranty_claims 
       WHERE warranty_id = $1 AND tenant_id = $2`,
      [warrantyId, tenantId]
    );
    repeatCount = countRes.rows[0].count;
    isRepeat = repeatCount > 0;
  }

  const query = `
    INSERT INTO warranty_claims (
      tenant_id, project_id, warranty_id, amc_id, claim_number, 
      claim_date, nature_of_defect, status, eligibility_decision,
      is_repeat_claim, repeat_claim_count
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, 'open', 'pending', $8, $9)
    RETURNING *
  `;
  const values = [
    tenantId, projectId, warrantyId, amcId, claimNumber,
    claimDate, natureOfDefect, isRepeat, repeatCount
  ];

  const { rows } = await pool.query(query, values);
  const claim = rows[0];

  // Send notifications for repeat claims
  if (isRepeat) {
    try {
      const projRes = await pool.query('SELECT name, pm_id FROM projects WHERE id = $1', [projectId]);
      const project = projRes.rows[0];
      const prodRes = await pool.query('SELECT product_name FROM warranties WHERE id = $1', [warrantyId]);
      const productName = prodRes.rows[0]?.product_name || 'Product';

      const notifyUsers = [];
      if (project?.pm_id) {
        notifyUsers.push(project.pm_id);
      }
      
      const adminUsersRes = await pool.query(
        `SELECT u.id FROM users u
         JOIN roles r ON u.role_id = r.id
         WHERE u.tenant_id = $1 AND (r.name IN ('superadmin', 'admin', 'finance'))`,
        [tenantId]
      );
      adminUsersRes.rows.forEach(row => {
        if (!notifyUsers.includes(row.id)) notifyUsers.push(row.id);
      });

      for (const recipientId of notifyUsers) {
        await pool.query(
          `INSERT INTO notifications (tenant_id, user_id, type, message, reference_url)
           VALUES ($1, $2, 'repeat_warranty_claim', $3, $4)`,
          [
            tenantId,
            recipientId,
            `Alert: Repeat warranty claim on product '${productName}' (Claim #${claimNumber}). This item has been claimed ${repeatCount + 1} times.`,
            `/projects/${projectId}/warranty-claims`
          ]
        );
      }
    } catch (err) {
      console.error('[Warranty Claim Service] Failed to send repeat claim notifications:', err.message);
    }
  }

  // Log audit action
  await logAction({
    tenantId,
    userId,
    action: 'warranty_claim.created',
    entity: 'warranty_claim',
    entityId: claim.id,
    newValue: claim
  });

  return claim;
}

/**
 * Updates a warranty claim status, assignments, decisions, etc.
 */
async function updateClaim(claimId, tenantId, updateData, userId = null) {
  const existingRes = await pool.query(
    'SELECT * FROM warranty_claims WHERE id = $1 AND tenant_id = $2',
    [claimId, tenantId]
  );
  if (existingRes.rows.length === 0) {
    throw new Error('CLAIM_NOT_FOUND');
  }
  const oldValue = existingRes.rows[0];

  const allowedKeys = [
    'warranty_id', 'amc_id', 'claim_date', 'nature_of_defect', 'eligibility_decision',
    'eligibility_reason', 'assigned_technician_id', 'status', 'resolution_details'
  ];

  const updateFields = [];
  const values = [];
  let idx = 1;

  for (const key of allowedKeys) {
    if (updateData[key] !== undefined) {
      updateFields.push(`${key} = $${idx}`);
      values.push(updateData[key]);
      idx++;
    }
  }

  // Handle status transitions to set timestamp
  if (updateData.status === 'resolved' && oldValue.status !== 'resolved') {
    updateFields.push(`resolved_at = CURRENT_TIMESTAMP`);
  }
  if (updateData.status === 'closed' && oldValue.status !== 'closed') {
    updateFields.push(`closed_at = CURRENT_TIMESTAMP`);
  }

  if (updateFields.length === 0) {
    return oldValue;
  }

  values.push(claimId);
  values.push(tenantId);
  const query = `
    UPDATE warranty_claims
    SET ${updateFields.join(', ')}, updated_at = CURRENT_TIMESTAMP
    WHERE id = $${idx} AND tenant_id = $${idx + 1}
    RETURNING *
  `;

  const { rows } = await pool.query(query, values);
  const newValue = rows[0];

  // Log audit action
  await logAction({
    tenantId,
    userId,
    action: 'warranty_claim.updated',
    entity: 'warranty_claim',
    entityId: claimId,
    oldValue,
    newValue
  });

  return newValue;
}

/**
 * Deletes a warranty claim.
 */
async function deleteClaim(claimId, tenantId, userId = null) {
  const existingRes = await pool.query(
    'SELECT * FROM warranty_claims WHERE id = $1 AND tenant_id = $2',
    [claimId, tenantId]
  );
  if (existingRes.rows.length === 0) {
    throw new Error('CLAIM_NOT_FOUND');
  }
  const oldValue = existingRes.rows[0];

  await pool.query(
    'DELETE FROM warranty_claims WHERE id = $1 AND tenant_id = $2',
    [claimId, tenantId]
  );

  // Log audit action
  await logAction({
    tenantId,
    userId,
    action: 'warranty_claim.deleted',
    entity: 'warranty_claim',
    entityId: claimId,
    oldValue
  });

  return oldValue;
}

/**
 * Lists claims for a project. Includes matching product name from warranties.
 */
async function getClaimsByProject(projectId, tenantId) {
  const query = `
    SELECT 
      c.*,
      w.product_name,
      w.brand,
      w.serial_number,
      u.name AS technician_name,
      a.contract_number AS amc_contract_number
    FROM warranty_claims c
    LEFT JOIN warranties w ON c.warranty_id = w.id
    LEFT JOIN amcs a ON c.amc_id = a.id
    LEFT JOIN users u ON c.assigned_technician_id = u.id
    WHERE c.project_id = $1 AND c.tenant_id = $2
    ORDER BY c.claim_date DESC, c.created_at DESC
  `;
  const { rows } = await pool.query(query, [projectId, tenantId]);
  return rows;
}

module.exports = {
  createClaim,
  updateClaim,
  deleteClaim,
  getClaimsByProject
};
