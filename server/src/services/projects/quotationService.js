const pool = require('../../db/pool');
const { getTenantThreshold, isUserSuperadmin } = require('../../utils/finance');

class QuotationService {
  async createQuotation(tenantId, data) {
    const { leadId, projectId, createdBy, quotationNumber, notes, termsConditions, validUntil, changeReason } = data;
    
    const query = `
      INSERT INTO quotations 
      (tenant_id, lead_id, project_id, created_by, quotation_number, notes, terms_conditions, valid_until, change_reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
      RETURNING *
    `;
    const values = [tenantId, leadId, projectId, createdBy, quotationNumber, notes, termsConditions, validUntil, changeReason || null];
    const result = await pool.query(query, values);
    return result.rows[0];
  }

  async getQuotationById(tenantId, quotationId) {
    const query = `SELECT * FROM quotations WHERE id = $1 AND tenant_id = $2`;
    const result = await pool.query(query, [quotationId, tenantId]);
    return result.rows[0];
  }

  async getQuotationsByProjectId(tenantId, projectId) {
    const query = `
      SELECT q.*, u.name as creator_name 
      FROM quotations q
      LEFT JOIN users u ON q.created_by = u.id
      WHERE q.project_id = $1 AND q.tenant_id = $2
      ORDER BY q.version DESC, q.created_at DESC
    `;
    const result = await pool.query(query, [projectId, tenantId]);
    return result.rows;
  }

  async addBOQItem(tenantId, quotationId, itemData) {
    const { parentItemId, roomOrArea, itemName, description, unit, quantity, unitPrice, markupPercentage, materialSpecifications, brand, sortOrder, itemKey, scopeType, changeOrderId, hsnCode, gstRate } = itemData;

    const query = `
      INSERT INTO quotation_items 
      (tenant_id, quotation_id, parent_item_id, room_or_area, item_name, description, unit, quantity, unit_price, markup_percentage, material_specifications, brand, sort_order, item_key, scope_type, change_order_id, hsn_code, gst_rate)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, COALESCE($14, gen_random_uuid()), COALESCE($15, 'original'), $16, $17, $18)
      RETURNING *
    `;
    const values = [
      tenantId, quotationId, parentItemId || null, roomOrArea, itemName, description, 
      unit, quantity, unitPrice, markupPercentage, materialSpecifications, brand, sortOrder, itemKey || null,
      scopeType || 'original', changeOrderId || null, hsnCode || null, gstRate || 0.00
    ];

    const result = await pool.query(query, values);
    await this.updateQuotationTotals(tenantId, quotationId);
    
    // Re-fetch updated item to get dynamically computed tax split columns
    const finalRes = await pool.query('SELECT * FROM quotation_items WHERE id = $1 AND tenant_id = $2', [result.rows[0].id, tenantId]);
    return finalRes.rows[0];
  }

  async updateBOQItem(tenantId, itemId, itemData) {
    // 1. Fetch current item details to compare spec changes
    const currentRes = await pool.query(
      `SELECT qi.*, q.project_id, q.status as quotation_status 
       FROM quotation_items qi
       JOIN quotations q ON qi.quotation_id = q.id
       WHERE qi.id = $1 AND qi.tenant_id = $2`,
      [itemId, tenantId]
    );
    if (currentRes.rows.length > 0) {
      const currentItem = currentRes.rows[0];
      
      if (currentItem.quotation_status === 'accepted') {
        // Check if brand, material_specifications, or unit_price are changing
        const isBrandChanging = itemData.brand !== undefined && (itemData.brand || null) !== (currentItem.brand || null);
        const isSpecChanging = itemData.materialSpecifications !== undefined && (itemData.materialSpecifications || null) !== (currentItem.material_specifications || null);
        const isPriceChanging = itemData.unitPrice !== undefined && Number(itemData.unitPrice) !== Number(currentItem.unit_price);

        if (isBrandChanging || isSpecChanging || isPriceChanging) {
          // Automatically generate a material substitution request for client approval
          const materialSubstitutionService = require('./materialSubstitutionService');
          await materialSubstitutionService.createMaterialSubstitution(tenantId, currentItem.project_id, {
            boqItemId: itemId,
            reasonShortage: 'Material specification/brand/cost update in BOQ',
            replacementItemName: itemData.itemName !== undefined ? itemData.itemName : currentItem.item_name,
            replacementBrand: itemData.brand !== undefined ? itemData.brand : currentItem.brand,
            replacementMaterialSpecifications: itemData.materialSpecifications !== undefined ? itemData.materialSpecifications : currentItem.material_specifications,
            replacementUnitPrice: itemData.unitPrice !== undefined ? Number(itemData.unitPrice) : Number(currentItem.unit_price)
          });

          // Strip these fields from itemData so they are NOT directly updated without client sign-off
          delete itemData.brand;
          delete itemData.materialSpecifications;
          delete itemData.unitPrice;
          delete itemData.itemName;
        }
      }
    }

    const fields = [];
    const values = [tenantId, itemId];
    let index = 3;

    const updateableFields = {
      room_or_area: 'roomOrArea',
      item_name: 'itemName',
      description: 'description',
      unit: 'unit',
      quantity: 'quantity',
      unit_price: 'unitPrice',
      markup_percentage: 'markupPercentage',
      material_specifications: 'materialSpecifications',
      brand: 'brand',
      sort_order: 'sortOrder',
      scope_type: 'scopeType',
      change_order_id: 'changeOrderId',
      hsn_code: 'hsnCode',
      gst_rate: 'gstRate'
    };

    for (const [colName, jsKey] of Object.entries(updateableFields)) {
      if (itemData[jsKey] !== undefined) {
        fields.push(`${colName} = $${index}`);
        let val = itemData[jsKey];
        if (val === '') val = null;
        values.push(val);
        index++;
      }
    }

    if (fields.length === 0) {
      const res = await pool.query('SELECT * FROM quotation_items WHERE id = $1 AND tenant_id = $2', [itemId, tenantId]);
      return res.rows[0];
    }

    const query = `
      UPDATE quotation_items
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND tenant_id = $1
      RETURNING *
    `;
    const result = await pool.query(query, values);
    if (result.rowCount === 0) return null;
    
    const item = result.rows[0];
    await this.updateQuotationTotals(tenantId, item.quotation_id);
    
    // Re-fetch updated item to get dynamically computed tax split columns
    const finalRes = await pool.query('SELECT * FROM quotation_items WHERE id = $1 AND tenant_id = $2', [itemId, tenantId]);
    return finalRes.rows[0];
  }

  async deleteBOQItem(tenantId, itemId) {
    const getQuery = `SELECT quotation_id FROM quotation_items WHERE id = $1 AND tenant_id = $2`;
    const getRes = await pool.query(getQuery, [itemId, tenantId]);
    if (getRes.rowCount === 0) return false;
    const quotationId = getRes.rows[0].quotation_id;

    const deleteQuery = `DELETE FROM quotation_items WHERE id = $1 AND tenant_id = $2`;
    await pool.query(deleteQuery, [itemId, tenantId]);
    await this.updateQuotationTotals(tenantId, quotationId);
    return true;
  }

  async updateQuotationTotals(tenantId, quotationId, client = pool) {
    // 1. Fetch current quotation configuration
    const qQuery = 'SELECT status, gst_type, discount_amount FROM quotations WHERE id = $1 AND tenant_id = $2';
    const qRes = await client.query(qQuery, [quotationId, tenantId]);
    if (qRes.rowCount === 0) return null;
    const { status, gst_type: gstType, discount_amount: discountAmountStr } = qRes.rows[0];
    const discountAmount = parseFloat(discountAmountStr || 0);

    // 2. Recompute CGST, SGST, IGST on each line item based on parent's gst_type and line-item's own gst_rate
    const recomputeItemsQuery = `
      UPDATE quotation_items
      SET cgst_amount = CASE WHEN $1 = 'cgst_sgst' THEN (total_price * (gst_rate / 100.0) / 2.0) ELSE 0.00 END,
          sgst_amount = CASE WHEN $1 = 'cgst_sgst' THEN (total_price * (gst_rate / 100.0) / 2.0) ELSE 0.00 END,
          igst_amount = CASE WHEN $1 = 'igst' THEN (total_price * (gst_rate / 100.0)) ELSE 0.00 END
      WHERE quotation_id = $2 AND tenant_id = $3
    `;
    await client.query(recomputeItemsQuery, [gstType, quotationId, tenantId]);

    // 3. Sum up all BOQ items' subtotals and tax splits (negating reductions)
    const sumQuery = `
      SELECT 
        COALESCE(SUM(
          CASE 
            WHEN scope_type = 'original' THEN total_price
            WHEN scope_type = 'addition' AND ($1 != 'accepted' OR pco.status = 'approved') THEN total_price
            WHEN scope_type = 'reduction' AND ($1 != 'accepted' OR pco.status = 'approved') THEN -total_price
            ELSE 0 
          END
        ), 0) as new_subtotal,
        COALESCE(SUM(
          CASE 
            WHEN scope_type = 'original' THEN cgst_amount
            WHEN scope_type = 'addition' AND ($1 != 'accepted' OR pco.status = 'approved') THEN cgst_amount
            WHEN scope_type = 'reduction' AND ($1 != 'accepted' OR pco.status = 'approved') THEN -cgst_amount
            ELSE 0 
          END
        ), 0) as new_cgst,
        COALESCE(SUM(
          CASE 
            WHEN scope_type = 'original' THEN sgst_amount
            WHEN scope_type = 'addition' AND ($1 != 'accepted' OR pco.status = 'approved') THEN sgst_amount
            WHEN scope_type = 'reduction' AND ($1 != 'accepted' OR pco.status = 'approved') THEN -sgst_amount
            ELSE 0 
          END
        ), 0) as new_sgst,
        COALESCE(SUM(
          CASE 
            WHEN scope_type = 'original' THEN igst_amount
            WHEN scope_type = 'addition' AND ($1 != 'accepted' OR pco.status = 'approved') THEN igst_amount
            WHEN scope_type = 'reduction' AND ($1 != 'accepted' OR pco.status = 'approved') THEN -igst_amount
            ELSE 0 
          END
        ), 0) as new_igst
      FROM quotation_items qi
      LEFT JOIN project_change_orders pco ON qi.change_order_id = pco.id
      WHERE qi.quotation_id = $2 AND qi.tenant_id = $3
    `;
    const sumResult = await client.query(sumQuery, [status, quotationId, tenantId]);
    const newSubtotal = parseFloat(sumResult.rows[0].new_subtotal);
    const newCgst = parseFloat(sumResult.rows[0].new_cgst);
    const newSgst = parseFloat(sumResult.rows[0].new_sgst);
    const newIgst = parseFloat(sumResult.rows[0].new_igst);
    const newTax = newCgst + newSgst + newIgst;
    const newTotal = newSubtotal + newTax - discountAmount;

    // 4. Write back totals and splits to parent quotation
    const updateQuery = `
      UPDATE quotations
      SET subtotal = $1,
          cgst_total = $2,
          sgst_total = $3,
          igst_total = $4,
          tax_amount = $5,
          total_amount = $6,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $7 AND tenant_id = $8
      RETURNING *
    `;
    const updateResult = await client.query(updateQuery, [
      newSubtotal, newCgst, newSgst, newIgst, newTax, newTotal, quotationId, tenantId
    ]);
    return updateResult.rows[0];
  }

  async getQuotationWithItems(tenantId, quotationId) {
    const quotation = await this.getQuotationById(tenantId, quotationId);
    if (!quotation) return null;

    const itemsQuery = `
      SELECT qi.*, pco.title as change_order_title 
      FROM quotation_items qi
      LEFT JOIN project_change_orders pco ON qi.change_order_id = pco.id
      WHERE qi.quotation_id = $1 AND qi.tenant_id = $2
      ORDER BY qi.sort_order ASC, qi.created_at ASC
    `;
    const itemsResult = await pool.query(itemsQuery, [quotationId, tenantId]);
    
    quotation.items = itemsResult.rows;
    return quotation;
  }

  async reviseQuotation(tenantId, quotationId, userId, changeReason) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch base quotation
      const baseQuery = `SELECT * FROM quotations WHERE id = $1 AND tenant_id = $2`;
      const baseRes = await client.query(baseQuery, [quotationId, tenantId]);
      if (baseRes.rowCount === 0) {
        throw new Error('Quotation not found');
      }
      const base = baseRes.rows[0];

      // 2. Mark previous version status as 'revised' if it was draft or sent
      if (base.status === 'draft' || base.status === 'sent') {
        await client.query(
          `UPDATE quotations SET status = 'revised', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
          [quotationId, tenantId]
        );
      }

      // 3. Create new quotation version
      const nextVersion = base.version + 1;
      const insertQuoteQuery = `
        INSERT INTO quotations 
        (tenant_id, lead_id, project_id, created_by, quotation_number, status, version, subtotal, tax_amount, discount_amount, total_amount, notes, terms_conditions, valid_until, change_reason, gst_type, cgst_total, sgst_total, igst_total)
        VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18)
        RETURNING *
      `;
      const quoteValues = [
        tenantId, base.lead_id, base.project_id, userId, base.quotation_number,
        nextVersion, base.subtotal, base.tax_amount, base.discount_amount, base.total_amount,
        base.notes, base.terms_conditions, base.valid_until, changeReason,
        base.gst_type || 'cgst_sgst', base.cgst_total || 0, base.sgst_total || 0, base.igst_total || 0
      ];
      const newQuoteRes = await client.query(insertQuoteQuery, quoteValues);
      const newQuotation = newQuoteRes.rows[0];
      const newQuotationId = newQuotation.id;

      // 4. Fetch all old items
      const itemsQuery = `SELECT * FROM quotation_items WHERE quotation_id = $1 AND tenant_id = $2`;
      const itemsRes = await client.query(itemsQuery, [quotationId, tenantId]);
      const oldItems = itemsRes.rows;

      // 5. Clone items and construct old -> new ID mapping to handle parent-child hierarchy
      const idMap = {}; // oldId -> newId
      for (const item of oldItems) {
        const insertItemQuery = `
          INSERT INTO quotation_items 
          (tenant_id, quotation_id, parent_item_id, room_or_area, item_name, description, unit, quantity, unit_price, markup_percentage, material_specifications, brand, sort_order, item_key, scope_type, change_order_id, hsn_code, gst_rate, cgst_amount, sgst_amount, igst_amount)
          VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19, $20)
          RETURNING id
        `;
        const values = [
          tenantId, newQuotationId, item.room_or_area, item.item_name, item.description,
          item.unit, item.quantity, item.unit_price, item.markup_percentage,
          item.material_specifications, item.brand, item.sort_order, item.item_key,
          item.scope_type, item.change_order_id, item.hsn_code, item.gst_rate,
          item.cgst_amount, item.sgst_amount, item.igst_amount
        ];
        const insertRes = await client.query(insertItemQuery, values);
        idMap[item.id] = insertRes.rows[0].id;
      }

      // 6. Update parent_item_id for hierarchical items
      for (const item of oldItems) {
        if (item.parent_item_id && idMap[item.parent_item_id]) {
          const newChildId = idMap[item.id];
          const newParentId = idMap[item.parent_item_id];
          await client.query(
            `UPDATE quotation_items SET parent_item_id = $1 WHERE id = $2 AND tenant_id = $3`,
            [newParentId, newChildId, tenantId]
          );
        }
      }

      await client.query('COMMIT');
      
      newQuotation.items = await this.getQuotationWithItems(tenantId, newQuotationId).then(q => q.items);
      return newQuotation;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async compareQuotations(tenantId, baseId, targetId) {
    const base = await this.getQuotationWithItems(tenantId, baseId);
    const target = await this.getQuotationWithItems(tenantId, targetId);

    if (!base || !target) {
      throw new Error('One or both quotations not found');
    }

    const baseItemsMap = new Map();
    base.items.forEach(item => baseItemsMap.set(item.item_key, item));

    const targetItemsMap = new Map();
    target.items.forEach(item => targetItemsMap.set(item.item_key, item));

    const diffs = [];

    // 1. Check for removed and changed items
    for (const [key, baseItem] of baseItemsMap.entries()) {
      if (!targetItemsMap.has(key)) {
        diffs.push({
          type: 'removed',
          item_key: key,
          room_or_area: baseItem.room_or_area,
          item_name: baseItem.item_name,
          base_item: baseItem,
          target_item: null,
          changes: null
        });
      } else {
        const targetItem = targetItemsMap.get(key);
        const qtyChanged = parseFloat(baseItem.quantity) !== parseFloat(targetItem.quantity);
        const priceChanged = parseFloat(baseItem.unit_price) !== parseFloat(targetItem.unit_price);
        const nameChanged = baseItem.item_name !== targetItem.item_name;
        const roomChanged = baseItem.room_or_area !== targetItem.room_or_area;
        const descChanged = (baseItem.description || '') !== (targetItem.description || '');

        const scopeTypeChanged = baseItem.scope_type !== targetItem.scope_type;
        const changeOrderChanged = baseItem.change_order_id !== targetItem.change_order_id;
        const hsnChanged = baseItem.hsn_code !== targetItem.hsn_code;
        const gstRateChanged = parseFloat(baseItem.gst_rate) !== parseFloat(targetItem.gst_rate);

        if (qtyChanged || priceChanged || nameChanged || roomChanged || descChanged || scopeTypeChanged || changeOrderChanged || hsnChanged || gstRateChanged) {
          diffs.push({
            type: 'changed',
            item_key: key,
            room_or_area: targetItem.room_or_area,
            item_name: targetItem.item_name,
            base_item: baseItem,
            target_item: targetItem,
            changes: {
              quantity: qtyChanged ? { old: baseItem.quantity, new: targetItem.quantity } : null,
              unit_price: priceChanged ? { old: baseItem.unit_price, new: targetItem.unit_price } : null,
              total_price: { old: baseItem.total_price, new: targetItem.total_price },
              item_name: nameChanged ? { old: baseItem.item_name, new: targetItem.item_name } : null,
              room_or_area: roomChanged ? { old: baseItem.room_or_area, new: targetItem.room_or_area } : null,
              scope_type: scopeTypeChanged ? { old: baseItem.scope_type, new: targetItem.scope_type } : null,
              change_order_id: changeOrderChanged ? { old: baseItem.change_order_id, new: targetItem.change_order_id } : null,
              hsn_code: hsnChanged ? { old: baseItem.hsn_code, new: targetItem.hsn_code } : null,
              gst_rate: gstRateChanged ? { old: baseItem.gst_rate, new: targetItem.gst_rate } : null
            }
          });
        } else {
          diffs.push({
            type: 'unchanged',
            item_key: key,
            room_or_area: targetItem.room_or_area,
            item_name: targetItem.item_name,
            base_item: baseItem,
            target_item: targetItem,
            changes: null
          });
        }
      }
    }

    // 2. Check for added items
    for (const [key, targetItem] of targetItemsMap.entries()) {
      if (!baseItemsMap.has(key)) {
        diffs.push({
          type: 'added',
          item_key: key,
          room_or_area: targetItem.room_or_area,
          item_name: targetItem.item_name,
          base_item: null,
          target_item: targetItem,
          changes: null
        });
      }
    }

    // Get creator names
    const creatorsQuery = `
      SELECT id, name FROM users 
      WHERE id IN (
        SELECT created_by FROM quotations WHERE id IN ($1, $2)
      )
    `;
    const creatorsRes = await pool.query(creatorsQuery, [baseId, targetId]);
    const creatorsMap = new Map(creatorsRes.rows.map(u => [u.id, u.name]));

    base.creator_name = creatorsMap.get(base.created_by) || 'System';
    target.creator_name = creatorsMap.get(target.created_by) || 'System';

    return {
      baseQuotation: {
        id: base.id,
        version: base.version,
        status: base.status,
        subtotal: base.subtotal,
        total_amount: base.total_amount,
        change_reason: base.change_reason,
        created_at: base.created_at,
        creator_name: base.creator_name
      },
      targetQuotation: {
        id: target.id,
        version: target.version,
        status: target.status,
        subtotal: target.subtotal,
        total_amount: target.total_amount,
        change_reason: target.change_reason,
        created_at: target.created_at,
        creator_name: target.creator_name
      },
      diffs
    };
  }

  async sendQuotation(tenantId, quotationId) {
    const query = `
      UPDATE quotations
      SET status = 'sent',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2 AND status = 'draft'
      RETURNING *
    `;
    const result = await pool.query(query, [quotationId, tenantId]);
    return result.rows[0];
  }

  async acceptQuotation(tenantId, quotationId) {
    const query = `
      UPDATE quotations
      SET status = 'accepted',
          accepted_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2 AND (status = 'draft' OR status = 'sent')
      RETURNING *
    `;
    const result = await pool.query(query, [quotationId, tenantId]);
    return result.rows[0];
  }

  async rejectQuotation(tenantId, quotationId) {
    const query = `
      UPDATE quotations
      SET status = 'rejected',
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND tenant_id = $2 AND status = 'sent'
      RETURNING *
    `;
    const result = await pool.query(query, [quotationId, tenantId]);
    return result.rows[0];
  }

  async updateQuotation(tenantId, quotationId, data, userId = null, bypassApproval = false) {
    if (data.discountAmount !== undefined && !bypassApproval) {
      const discountVal = Number(data.discountAmount);
      const threshold = await getTenantThreshold(tenantId, 'finance_discount_threshold', 50000.00);
      const isSuperadmin = await isUserSuperadmin(userId);
      if (!isSuperadmin && discountVal > threshold) {
        // Create financial approval record
        await pool.query(
          `INSERT INTO financial_approvals (
             tenant_id, transaction_type, target_id, amount, requested_by, requested_changes, status, threshold_limit
           ) VALUES ($1, 'discount', $2, $3, $4, $5, 'pending', $6)`,
          [tenantId, quotationId, discountVal, userId, JSON.stringify({ discountAmount: discountVal }), threshold]
        );
        
        // Remove discountAmount from data and update everything else
        const dataCopy = { ...data };
        delete dataCopy.discountAmount;
        return this.updateQuotation(tenantId, quotationId, dataCopy, userId, true);
      }
    }

    const fields = [];
    const values = [tenantId, quotationId];
    let index = 3;

    const updateableFields = {
      notes: 'notes',
      terms_conditions: 'termsConditions',
      valid_until: 'validUntil',
      discount_amount: 'discountAmount',
      gst_type: 'gstType'
    };

    for (const [colName, jsKey] of Object.entries(updateableFields)) {
      if (data[jsKey] !== undefined) {
        fields.push(`${colName} = $${index}`);
        let val = data[jsKey];
        if (val === '') val = null;
        values.push(val);
        index++;
      }
    }

    if (fields.length === 0) {
      return this.getQuotationWithItems(tenantId, quotationId);
    }

    const query = `
      UPDATE quotations
      SET ${fields.join(', ')}, updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND tenant_id = $1
      RETURNING *
    `;
    const result = await pool.query(query, values);
    if (result.rowCount === 0) return null;

    await this.updateQuotationTotals(tenantId, quotationId);
    return this.getQuotationWithItems(tenantId, quotationId);
  }
}

module.exports = new QuotationService();
