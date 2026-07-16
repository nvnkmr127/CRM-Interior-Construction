const pool = require('../../db/pool');

class PurchaseOrderService {
  async createPurchaseOrder(tenantId, userId, projectId, poData) {
    const { vendorId, expectedDeliveryDate, notes, termsConditions, items } = poData;
    
    // Auto-generate PO number if not provided
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const poNumber = poData.poNumber || `PO-${dateStr}-${randomSuffix}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Get vendor details to store or check
      let vendorName = 'Unknown Vendor';
      if (vendorId) {
        const vendorRes = await client.query(
          'SELECT vendor_name FROM project_vendors WHERE id = $1 AND tenant_id = $2',
          [vendorId, tenantId]
        );
        if (vendorRes.rows.length > 0) {
          vendorName = vendorRes.rows[0].vendor_name;
        }
      }

      // Fetch default delivery address from project site_address if not provided
      const projectRes = await client.query('SELECT site_address FROM projects WHERE id = $1', [projectId]);
      const defaultAddress = projectRes.rows.length > 0 ? projectRes.rows[0].site_address : '';
      const deliveryAddress = poData.deliveryAddress || defaultAddress;

      // 2. Insert main PO
      const poQuery = `
        INSERT INTO purchase_orders 
        (tenant_id, project_id, vendor_id, po_number, status, expected_delivery_date, notes, terms_conditions, total_amount, delivery_address)
        VALUES ($1, $2, $3, $4, 'draft', $5, $6, $7, 0.00, $8)
        RETURNING *
      `;
      const poRes = await client.query(poQuery, [
        tenantId,
        projectId,
        vendorId || null,
        poNumber,
        expectedDeliveryDate || null,
        notes || null,
        termsConditions || null,
        deliveryAddress || null
      ]);
      const po = poRes.rows[0];

      // 3. Insert items
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          let itemName = item.itemName;
          let description = item.description;
          let unit = item.unit;
          let unitPrice = item.unitPrice || 0.00;
          let brand = item.brand;
          let materialSpecifications = item.materialSpecifications;

          // Fetch specifications from BOQ item if ID is provided
          if (item.boqItemId) {
            const boqRes = await client.query(
              'SELECT item_name, description, unit, unit_price, brand, material_specifications FROM quotation_items WHERE id = $1 AND tenant_id = $2',
              [item.boqItemId, tenantId]
            );
            if (boqRes.rows.length > 0) {
              const boqItem = boqRes.rows[0];
              itemName = itemName || boqItem.item_name;
              description = description || boqItem.description;
              unit = unit || boqItem.unit;
              if (item.unitPrice === undefined) {
                unitPrice = boqItem.unit_price;
              }
              brand = brand || boqItem.brand;
              materialSpecifications = materialSpecifications || boqItem.material_specifications;
            }
          }

          const itemQuery = `
            INSERT INTO purchase_order_items
            (tenant_id, purchase_order_id, boq_item_id, item_name, description, quantity, unit, unit_price, quantity_received, brand, material_specifications)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0.00, $9, $10)
          `;
          await client.query(itemQuery, [
            tenantId,
            po.id,
            item.boqItemId || null,
            itemName,
            description || null,
            item.quantity || 1.00,
            unit || null,
            unitPrice,
            brand || null,
            materialSpecifications || null
          ]);
        }
      }

      // 4. Update total PO amount
      const updateRes = await client.query(
        `UPDATE purchase_orders
         SET total_amount = (SELECT COALESCE(SUM(quantity * unit_price), 0.00) FROM purchase_order_items WHERE purchase_order_id = $1)
         WHERE id = $1
         RETURNING *`,
        [po.id]
      );

      await client.query('COMMIT');
      
      const finalPo = updateRes.rows[0];
      finalPo.vendor_name = vendorName;
      finalPo.items = await this.getPOItems(client, tenantId, po.id);
      return finalPo;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getPOItems(client, tenantId, poId) {
    const res = await client.query(
      'SELECT * FROM purchase_order_items WHERE purchase_order_id = $1 AND tenant_id = $2 ORDER BY created_at ASC',
      [poId, tenantId]
    );
    return res.rows;
  }

  async getPurchaseOrdersByProject(tenantId, projectId) {
    const query = `
      SELECT po.*, v.vendor_name
      FROM purchase_orders po
      LEFT JOIN project_vendors v ON po.vendor_id = v.id
      WHERE po.project_id = $1 AND po.tenant_id = $2
      ORDER BY po.created_at DESC
    `;
    const res = await pool.query(query, [projectId, tenantId]);
    return res.rows;
  }

  async getPurchaseOrderById(tenantId, projectId, poId) {
    const poQuery = `
      SELECT po.*, v.vendor_name
      FROM purchase_orders po
      LEFT JOIN project_vendors v ON po.vendor_id = v.id
      WHERE po.id = $1 AND po.project_id = $2 AND po.tenant_id = $3
    `;
    const poRes = await pool.query(poQuery, [poId, projectId, tenantId]);
    if (poRes.rows.length === 0) return null;

    const po = poRes.rows[0];
    po.items = await this.getPOItems(pool, tenantId, poId);
    return po;
  }

  async updatePurchaseOrder(tenantId, userId, projectId, poId, poData) {
    const { vendorId, expectedDeliveryDate, notes, termsConditions, status, deliveryAddress } = poData;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check existence
      const poCheck = await client.query(
        'SELECT * FROM purchase_orders WHERE id = $1 AND project_id = $2 AND tenant_id = $3',
        [poId, projectId, tenantId]
      );
      if (poCheck.rows.length === 0) {
        throw new Error('Purchase Order not found');
      }
      const _existingPo = poCheck.rows[0];

      const fields = [];
      const values = [tenantId, poId];
      let index = 3;

      if (vendorId !== undefined) {
        fields.push(`vendor_id = $${index++}`);
        values.push(vendorId);
      }
      if (expectedDeliveryDate !== undefined) {
        fields.push(`expected_delivery_date = $${index++}`);
        values.push(expectedDeliveryDate);
      }
      if (notes !== undefined) {
        fields.push(`notes = $${index++}`);
        values.push(notes);
      }
      if (termsConditions !== undefined) {
        fields.push(`terms_conditions = $${index++}`);
        values.push(termsConditions);
      }
      if (status !== undefined) {
        fields.push(`status = $${index++}`);
        values.push(status);
      }
      if (deliveryAddress !== undefined) {
        fields.push(`delivery_address = $${index++}`);
        values.push(deliveryAddress);
      }

      fields.push(`updated_at = NOW()`);

      const updateQuery = `
        UPDATE purchase_orders
        SET ${fields.join(', ')}
        WHERE id = $2 AND tenant_id = $1
        RETURNING *
      `;
      const res = await client.query(updateQuery, values);
      const updatedPo = res.rows[0];

      // Sync budget expenses
      await this.syncBudgetExpenses(client, tenantId, projectId, updatedPo);

      // Auto-generate PO PDF document on transition to 'sent'
      if (status === 'sent') {
        const { generatePurchaseOrderPDF } = require('./poPdfService');
        await generatePurchaseOrderPDF(tenantId, projectId, poId, userId).catch(err => {
          console.error('[PO PDF Service] Failed to generate PO PDF:', err);
        });
      }

      await client.query('COMMIT');
      
      // Get vendor name
      let vendorName = 'Unknown Vendor';
      if (updatedPo.vendor_id) {
        const vRes = await pool.query('SELECT vendor_name FROM project_vendors WHERE id = $1', [updatedPo.vendor_id]);
        if (vRes.rows.length > 0) vendorName = vRes.rows[0].vendor_name;
      }
      updatedPo.vendor_name = vendorName;
      updatedPo.items = await this.getPOItems(pool, tenantId, poId);
      return updatedPo;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async updatePOItemReceipt(tenantId, userId, projectId, poId, itemId, receiptData) {
    const { quantityReceived } = receiptData;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      // Fetch PO
      const poCheck = await client.query(
        'SELECT * FROM purchase_orders WHERE id = $1 AND project_id = $2 AND tenant_id = $3',
        [poId, projectId, tenantId]
      );
      if (poCheck.rows.length === 0) {
        throw new Error('Purchase Order not found');
      }
      const po = poCheck.rows[0];

      // Update item receipt qty
      const updateItemQuery = `
        UPDATE purchase_order_items
        SET quantity_received = $1, updated_at = NOW()
        WHERE id = $2 AND purchase_order_id = $3 AND tenant_id = $4
        RETURNING *
      `;
      const itemRes = await client.query(updateItemQuery, [quantityReceived, itemId, poId, tenantId]);
      if (itemRes.rows.length === 0) {
        throw new Error('PO item not found');
      }

      // Fetch all items to recalculate PO status
      const items = await this.getPOItems(client, tenantId, poId);
      
      let allFullyReceived = true;
      let anyReceived = false;

      for (const item of items) {
        const qty = parseFloat(item.quantity);
        const rec = parseFloat(item.quantity_received);
        if (rec > 0) {
          anyReceived = true;
        }
        if (rec < qty) {
          allFullyReceived = false;
        }
      }

      let newStatus = po.status;
      if (po.status === 'confirmed' || po.status === 'partially received' || po.status === 'received') {
        if (allFullyReceived) {
          newStatus = 'received';
        } else if (anyReceived) {
          newStatus = 'partially received';
        } else {
          newStatus = 'confirmed';
        }
      }

      // Update PO status if changed
      let updatedPo = po;
      if (newStatus !== po.status) {
        const poUpdateRes = await client.query(
          `UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
          [newStatus, poId]
        );
        updatedPo = poUpdateRes.rows[0];
      }

      // Sync budget expenses
      await this.syncBudgetExpenses(client, tenantId, projectId, updatedPo);

      await client.query('COMMIT');

      // Get vendor name
      let vendorName = 'Unknown Vendor';
      if (updatedPo.vendor_id) {
        const vRes = await pool.query('SELECT vendor_name FROM project_vendors WHERE id = $1', [updatedPo.vendor_id]);
        if (vRes.rows.length > 0) vendorName = vRes.rows[0].vendor_name;
      }
      updatedPo.vendor_name = vendorName;
      updatedPo.items = items;
      return updatedPo;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async syncBudgetExpenses(client, tenantId, projectId, po) {
    const poId = po.id;
    const status = po.status;

    // Get vendor name for description
    let vendorName = 'Vendor';
    if (po.vendor_id) {
      const vRes = await client.query('SELECT vendor_name FROM project_vendors WHERE id = $1', [po.vendor_id]);
      if (vRes.rows.length > 0) {
        vendorName = vRes.rows[0].vendor_name;
      }
    }
    const description = `PO ${po.po_number} - ${vendorName}`;

    // 1. Sync Committed Expense
    // Active statuses for committed cost: confirmed, partially received, received
    const isCommittedActive = ['confirmed', 'partially received', 'received'].includes(status);
    
    // Check if committed expense exists
    const commRes = await client.query(
      `SELECT id FROM project_expenses WHERE purchase_order_id = $1 AND type = 'committed' AND tenant_id = $2`,
      [poId, tenantId]
    );

    if (isCommittedActive) {
      if (commRes.rows.length > 0) {
        // Update existing committed expense amount
        await client.query(
          `UPDATE project_expenses SET amount = $1, description = $2, updated_at = NOW() WHERE id = $3`,
          [po.total_amount, description, commRes.rows[0].id]
        );
      } else {
        // Insert new committed expense
        await client.query(
          `INSERT INTO project_expenses (tenant_id, project_id, category, type, description, amount, incurred_date, purchase_order_id)
           VALUES ($1, $2, 'vendor', 'committed', $3, $4, CURRENT_DATE, $5)`,
          [tenantId, projectId, description, po.total_amount, poId]
        );
      }
    } else {
      // Remove committed cost if PO is draft, sent, or cancelled
      await client.query(
        `DELETE FROM project_expenses WHERE purchase_order_id = $1 AND type = 'committed' AND tenant_id = $2`,
        [poId, tenantId]
      );
    }

    // 2. Sync Actual Expense
    // Active statuses for actual cost: partially received, received
    const isActualActive = ['partially received', 'received'].includes(status);

    // Calculate actual received total value
    const receivedRes = await client.query(
      `SELECT COALESCE(SUM(quantity_received * unit_price), 0.00) as received_amount 
       FROM purchase_order_items 
       WHERE purchase_order_id = $1 AND tenant_id = $2`,
      [poId, tenantId]
    );
    const receivedAmount = parseFloat(receivedRes.rows[0].received_amount);

    const actRes = await client.query(
      `SELECT id FROM project_expenses WHERE purchase_order_id = $1 AND type = 'actual' AND tenant_id = $2`,
      [poId, tenantId]
    );

    if (isActualActive && receivedAmount > 0) {
      if (actRes.rows.length > 0) {
        // Update existing actual expense amount
        await client.query(
          `UPDATE project_expenses SET amount = $1, description = $2, updated_at = NOW() WHERE id = $3`,
          [receivedAmount, description, actRes.rows[0].id]
        );
      } else {
        // Insert new actual expense
        await client.query(
          `INSERT INTO project_expenses (tenant_id, project_id, category, type, description, amount, incurred_date, purchase_order_id)
           VALUES ($1, $2, 'vendor', 'actual', $3, $4, CURRENT_DATE, $5)`,
          [tenantId, projectId, description, receivedAmount, poId]
        );
      }
    } else {
      // Remove actual cost if not active or received amount is zero
      await client.query(
        `DELETE FROM project_expenses WHERE purchase_order_id = $1 AND type = 'actual' AND tenant_id = $2`,
        [poId, tenantId]
      );
    }
  }
}

module.exports = new PurchaseOrderService();
