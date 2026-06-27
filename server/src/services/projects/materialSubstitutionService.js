const pool = require('../../db/pool');
const quotationService = require('./quotationService');

class MaterialSubstitutionService {
  async createMaterialSubstitution(tenantId, projectId, data) {
    const { boqItemId, reasonShortage, replacementItemName, replacementBrand, replacementMaterialSpecifications, replacementUnitPrice } = data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch original BOQ item details to compute price difference and capture original spec audit trail
      const boqRes = await client.query(
        'SELECT item_name, brand, material_specifications, unit_price FROM quotation_items WHERE id = $1 AND tenant_id = $2',
        [boqItemId, tenantId]
      );
      if (boqRes.rows.length === 0) {
        throw new Error('BOQ item not found');
      }
      const originalItem = boqRes.rows[0];
      const originalPrice = parseFloat(originalItem.unit_price);
      const priceDifference = Number(replacementUnitPrice) - originalPrice;

      // 2. Insert substitution request with original specs audit trail
      const insertQuery = `
        INSERT INTO material_substitutions
        (tenant_id, project_id, boq_item_id, status, reason_shortage, 
         replacement_item_name, replacement_brand, replacement_material_specifications, replacement_unit_price, 
         price_difference, client_approval_status,
         original_item_name, original_brand, original_material_specifications, original_unit_price)
        VALUES ($1, $2, $3, 'pending', $4, $5, $6, $7, $8, $9, 'pending', $10, $11, $12, $13)
        RETURNING *
      `;
      const res = await client.query(insertQuery, [
        tenantId,
        projectId,
        boqItemId,
        reasonShortage,
        replacementItemName,
        replacementBrand || null,
        replacementMaterialSpecifications || null,
        Number(replacementUnitPrice) || 0.00,
        priceDifference,
        originalItem.item_name,
        originalItem.brand || null,
        originalItem.material_specifications || null,
        originalPrice
      ]);

      await client.query('COMMIT');
      return res.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getMaterialSubstitutionsByProject(tenantId, projectId) {
    const query = `
      SELECT ms.*, 
             qi.item_name as original_item_name, 
             qi.room_or_area as original_room_or_area, 
             qi.unit_price as original_unit_price, 
             qi.brand as original_brand, 
             qi.material_specifications as original_material_specifications,
             q.quotation_number,
             q.version as quotation_version
      FROM material_substitutions ms
      JOIN quotation_items qi ON ms.boq_item_id = qi.id
      JOIN quotations q ON qi.quotation_id = q.id
      WHERE ms.project_id = $1 AND ms.tenant_id = $2
      ORDER BY ms.created_at DESC
    `;
    const res = await pool.query(query, [projectId, tenantId]);
    return res.rows;
  }

  async getMaterialSubstitutionById(tenantId, projectId, subId) {
    const query = `
      SELECT ms.*, 
             qi.item_name as original_item_name, 
             qi.room_or_area as original_room_or_area, 
             qi.unit_price as original_unit_price, 
             qi.brand as original_brand, 
             qi.material_specifications as original_material_specifications,
             q.quotation_number,
             q.version as quotation_version
      FROM material_substitutions ms
      JOIN quotation_items qi ON ms.boq_item_id = qi.id
      JOIN quotations q ON qi.quotation_id = q.id
      WHERE ms.id = $1 AND ms.project_id = $2 AND ms.tenant_id = $3
    `;
    const res = await pool.query(query, [subId, projectId, tenantId]);
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async respondToSubstitution(tenantId, userId, projectId, subId, responseData) {
    const { clientApprovalStatus, clientFeedback, clientSignoffName, clientSignatureData } = responseData;
    
    if (!['approved', 'rejected'].includes(clientApprovalStatus)) {
      throw new Error('Invalid response status. Must be approved or rejected.');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch substitution request
      const checkRes = await client.query(
        'SELECT * FROM material_substitutions WHERE id = $1 AND project_id = $2 AND tenant_id = $3',
        [subId, projectId, tenantId]
      );
      if (checkRes.rows.length === 0) throw new Error('Material substitution request not found');
      const sub = checkRes.rows[0];

      // 2. Update substitution status and signature details
      const updateSubQuery = `
        UPDATE material_substitutions
        SET status = $1,
            client_approval_status = $1,
            client_approved_at = CURRENT_TIMESTAMP,
            client_feedback = $2,
            client_signoff_name = $3,
            client_signature_data = $4,
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $5 AND tenant_id = $6
        RETURNING *
      `;
      const updateSubRes = await client.query(updateSubQuery, [
        clientApprovalStatus,
        clientFeedback || null,
        clientSignoffName || null,
        clientSignatureData || null,
        subId,
        tenantId
      ]);
      const updatedSub = updateSubRes.rows[0];

      // 3. If approved, overwrite original BOQ item with replacement details
      if (clientApprovalStatus === 'approved') {
        const updateBOQQuery = `
          UPDATE quotation_items
          SET item_name = $1,
              brand = $2,
              material_specifications = $3,
              unit_price = $4,
              updated_at = CURRENT_TIMESTAMP
          WHERE id = $5 AND tenant_id = $6
          RETURNING quotation_id
        `;
        const boqUpdateRes = await client.query(updateBOQQuery, [
          sub.replacement_item_name,
          sub.replacement_brand,
          sub.replacement_material_specifications,
          sub.replacement_unit_price,
          sub.boq_item_id,
          tenantId
        ]);

        if (boqUpdateRes.rows.length > 0) {
          const quotationId = boqUpdateRes.rows[0].quotation_id;
          // Recalculate parent quotation totals
          await quotationService.updateQuotationTotals(tenantId, quotationId, client);
        }
      }

      await client.query('COMMIT');
      return updatedSub;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = new MaterialSubstitutionService();
