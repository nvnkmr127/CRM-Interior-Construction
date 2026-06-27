const pool = require('../../db/pool');
const { logAction } = require('../auditLog');

/**
 * Creates a new warranty record.
 */
async function createWarranty({
  tenantId,
  projectId,
  productName,
  serialNumber = null,
  brand = null,
  brandWarrantyMonths = 0,
  companyWarrantyMonths = 0,
  startDate,
  endDate,
  warrantyDocument = null,
  notes = null,
  handoverItemId = null,
  userId = null
}) {
  const query = `
    INSERT INTO warranties (
      tenant_id, project_id, product_name, serial_number, brand, 
      brand_warranty_months, company_warranty_months, start_date, end_date, 
      warranty_document, notes, handover_item_id
    )
    VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    RETURNING *
  `;
  const values = [
    tenantId, projectId, productName, serialNumber, brand,
    brandWarrantyMonths, companyWarrantyMonths, startDate, endDate,
    warrantyDocument, notes, handoverItemId
  ];

  const { rows } = await pool.query(query, values);
  const warranty = rows[0];

  // Log audit action
  await logAction({
    tenantId,
    userId,
    action: 'warranty.created',
    entity: 'warranty',
    entityId: warranty.id,
    newValue: warranty
  });

  return warranty;
}

/**
 * Updates an existing warranty record.
 */
async function updateWarranty(warrantyId, tenantId, updateData, userId = null) {
  // Fetch existing first for audit log and existence check
  const existingRes = await pool.query(
    'SELECT * FROM warranties WHERE id = $1 AND tenant_id = $2',
    [warrantyId, tenantId]
  );
  if (existingRes.rows.length === 0) {
    throw new Error('WARRANTY_NOT_FOUND');
  }
  const oldValue = existingRes.rows[0];

  const allowedKeys = [
    'product_name', 'serial_number', 'brand', 'brand_warranty_months',
    'company_warranty_months', 'start_date', 'end_date', 'warranty_document',
    'status', 'notes', 'handover_item_id'
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

  if (updateFields.length === 0) {
    return oldValue;
  }

  values.push(warrantyId);
  values.push(tenantId);
  const query = `
    UPDATE warranties
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
    action: 'warranty.updated',
    entity: 'warranty',
    entityId: warrantyId,
    oldValue,
    newValue
  });

  return newValue;
}

/**
 * Deletes a warranty record.
 */
async function deleteWarranty(warrantyId, tenantId, userId = null) {
  const existingRes = await pool.query(
    'SELECT * FROM warranties WHERE id = $1 AND tenant_id = $2',
    [warrantyId, tenantId]
  );
  if (existingRes.rows.length === 0) {
    throw new Error('WARRANTY_NOT_FOUND');
  }
  const oldValue = existingRes.rows[0];

  await pool.query(
    'DELETE FROM warranties WHERE id = $1 AND tenant_id = $2',
    [warrantyId, tenantId]
  );

  // Log audit action
  await logAction({
    tenantId,
    userId,
    action: 'warranty.deleted',
    entity: 'warranty',
    entityId: warrantyId,
    oldValue
  });

  return oldValue;
}

/**
 * Gets warranties for a specific project with calculated eligibility.
 */
async function getWarrantiesByProject(projectId, tenantId) {
  const query = `
    SELECT 
      w.*,
      CASE 
        WHEN w.status = 'voided' THEN 'voided'
        WHEN w.end_date < CURRENT_DATE THEN 'expired'
        ELSE 'active'
      END AS eligibility_status
    FROM warranties w
    WHERE w.project_id = $1 AND w.tenant_id = $2
    ORDER BY w.end_date DESC, w.product_name ASC
  `;
  const { rows } = await pool.query(query, [projectId, tenantId]);
  return rows;
}

module.exports = {
  createWarranty,
  updateWarranty,
  deleteWarranty,
  getWarrantiesByProject
};
