const pool = require('../../db/pool');

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
    const { parentItemId, roomOrArea, itemName, description, unit, quantity, unitPrice, markupPercentage, materialSpecifications, brand, sortOrder, itemKey } = itemData;

    const query = `
      INSERT INTO quotation_items 
      (tenant_id, quotation_id, parent_item_id, room_or_area, item_name, description, unit, quantity, unit_price, markup_percentage, material_specifications, brand, sort_order, item_key)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, COALESCE($14, gen_random_uuid()))
      RETURNING *
    `;
    const values = [
      tenantId, quotationId, parentItemId || null, roomOrArea, itemName, description, 
      unit, quantity, unitPrice, markupPercentage, materialSpecifications, brand, sortOrder, itemKey || null
    ];

    const result = await pool.query(query, values);
    await this.updateQuotationTotals(tenantId, quotationId);
    return result.rows[0];
  }

  async updateBOQItem(tenantId, itemId, itemData) {
    const { roomOrArea, itemName, description, unit, quantity, unitPrice, markupPercentage, materialSpecifications, brand, sortOrder } = itemData;
    
    const query = `
      UPDATE quotation_items
      SET room_or_area = COALESCE($1, room_or_area),
          item_name = COALESCE($2, item_name),
          description = COALESCE($3, description),
          unit = COALESCE($4, unit),
          quantity = COALESCE($5, quantity),
          unit_price = COALESCE($6, unit_price),
          markup_percentage = COALESCE($7, markup_percentage),
          material_specifications = COALESCE($8, material_specifications),
          brand = COALESCE($9, brand),
          sort_order = COALESCE($10, sort_order),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $11 AND tenant_id = $12
      RETURNING *
    `;
    const values = [
      roomOrArea, itemName, description, unit, quantity, unitPrice, markupPercentage,
      materialSpecifications, brand, sortOrder, itemId, tenantId
    ];
    
    const result = await pool.query(query, values);
    if (result.rowCount === 0) return null;
    
    const item = result.rows[0];
    await this.updateQuotationTotals(tenantId, item.quotation_id);
    return item;
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

  async updateQuotationTotals(tenantId, quotationId) {
    // Calculate the new total from quotation_items
    const sumQuery = `
      SELECT COALESCE(SUM(total_price), 0) as new_subtotal
      FROM quotation_items
      WHERE quotation_id = $1 AND tenant_id = $2
    `;
    const sumResult = await pool.query(sumQuery, [quotationId, tenantId]);
    const newSubtotal = parseFloat(sumResult.rows[0].new_subtotal);

    // Get current tax/discount to recalculate final total (simplified logic here)
    const updateQuery = `
      UPDATE quotations
      SET subtotal = $1,
          total_amount = $1 + tax_amount - discount_amount,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $2 AND tenant_id = $3
      RETURNING *
    `;
    const updateResult = await pool.query(updateQuery, [newSubtotal, quotationId, tenantId]);
    return updateResult.rows[0];
  }

  async getQuotationWithItems(tenantId, quotationId) {
    const quotation = await this.getQuotationById(tenantId, quotationId);
    if (!quotation) return null;

    const itemsQuery = `
      SELECT * FROM quotation_items 
      WHERE quotation_id = $1 AND tenant_id = $2
      ORDER BY sort_order ASC, created_at ASC
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
        (tenant_id, lead_id, project_id, created_by, quotation_number, status, version, subtotal, tax_amount, discount_amount, total_amount, notes, terms_conditions, valid_until, change_reason)
        VALUES ($1, $2, $3, $4, $5, 'draft', $6, $7, $8, $9, $10, $11, $12, $13, $14)
        RETURNING *
      `;
      const quoteValues = [
        tenantId, base.lead_id, base.project_id, userId, base.quotation_number,
        nextVersion, base.subtotal, base.tax_amount, base.discount_amount, base.total_amount,
        base.notes, base.terms_conditions, base.valid_until, changeReason
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
          (tenant_id, quotation_id, parent_item_id, room_or_area, item_name, description, unit, quantity, unit_price, markup_percentage, material_specifications, brand, sort_order, item_key)
          VALUES ($1, $2, NULL, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13)
          RETURNING id
        `;
        const values = [
          tenantId, newQuotationId, item.room_or_area, item.item_name, item.description,
          item.unit, item.quantity, item.unit_price, item.markup_percentage,
          item.material_specifications, item.brand, item.sort_order, item.item_key
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

        if (qtyChanged || priceChanged || nameChanged || roomChanged || descChanged) {
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
              room_or_area: roomChanged ? { old: baseItem.room_or_area, new: targetItem.room_or_area } : null
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
}

module.exports = new QuotationService();
