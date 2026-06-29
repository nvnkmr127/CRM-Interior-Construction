const pool = require('../../db/pool');

class PurchaseRequestService {
  async createPurchaseRequest(tenantId, userId, projectId, prData) {
    const { requiredByDate, deliveryLocation, notes, items } = prData;
    
    // Auto-generate PR number if not provided
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const prNumber = prData.prNumber || `PR-${dateStr}-${randomSuffix}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Insert main Purchase Request
      const prQuery = `
        INSERT INTO purchase_requests 
        (tenant_id, project_id, pr_number, status, requested_by, required_by_date, delivery_location, notes, total_amount)
        VALUES ($1, $2, $3, 'draft', $4, $5, $6, $7, 0.00)
        RETURNING *
      `;
      const prRes = await client.query(prQuery, [
        tenantId,
        projectId,
        prNumber,
        userId || null,
        requiredByDate,
        deliveryLocation || 'site',
        notes || null
      ]);
      const pr = prRes.rows[0];

      // 2. Insert items
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
            INSERT INTO purchase_request_items
            (tenant_id, purchase_request_id, boq_item_id, item_name, description, quantity, unit, unit_price, brand, material_specifications, material_category)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
          `;
          await client.query(itemQuery, [
            tenantId,
            pr.id,
            item.boqItemId || null,
            itemName,
            description || null,
            item.quantity || 1.00,
            unit || null,
            unitPrice,
            brand || null,
            materialSpecifications || null,
            item.materialCategory || 'general'
          ]);
        }
      }

      // 3. Update total PR amount
      const updateRes = await client.query(
        `UPDATE purchase_requests
         SET total_amount = (SELECT COALESCE(SUM(quantity * unit_price), 0.00) FROM purchase_request_items WHERE purchase_request_id = $1)
         WHERE id = $1
         RETURNING *`,
        [pr.id]
      );

      await client.query('COMMIT');
      
      const finalPr = updateRes.rows[0];
      finalPr.items = await this.getPRItems(client, tenantId, pr.id);
      return finalPr;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getPRItems(client, tenantId, prId) {
    const res = await client.query(
      `SELECT i.*, pr.required_by_date
       FROM purchase_request_items i
       JOIN purchase_requests pr ON i.purchase_request_id = pr.id
       WHERE i.purchase_request_id = $1 AND i.tenant_id = $2
       ORDER BY i.created_at ASC`,
      [prId, tenantId]
    );
    const rows = res.rows;

    const ltRes = await client.query(
      `SELECT material_category, lead_time_days
       FROM vendor_lead_times
       WHERE tenant_id = $1 AND vendor_id IS NULL`,
      [tenantId]
    );
    const leadTimeMap = {};
    ltRes.rows.forEach(r => {
      leadTimeMap[r.material_category] = r.lead_time_days;
    });

    const DEFAULT_LEAD_TIMES = {
      'plywood': 7,
      'hardware': 3,
      'laminate': 5,
      'paint': 3,
      'electrical': 4,
      'plumbing': 4,
      'modular': 15,
      'general': 5
    };

    return rows.map(row => {
      const category = row.material_category || 'general';
      const leadTimeDays = leadTimeMap[category] !== undefined ? leadTimeMap[category] : (DEFAULT_LEAD_TIMES[category] || 5);
      const requiredDate = new Date(row.required_by_date);
      const latestOrderDate = new Date(requiredDate.getTime() - leadTimeDays * 24 * 60 * 60 * 1000);
      return {
        ...row,
        lead_time_days: leadTimeDays,
        latest_order_date: latestOrderDate.toISOString()
      };
    });
  }

  async getPurchaseRequestsByProject(tenantId, projectId) {
    const query = `
      SELECT pr.*, u.name as requested_by_name
      FROM purchase_requests pr
      LEFT JOIN users u ON pr.requested_by = u.id
      WHERE pr.project_id = $1 AND pr.tenant_id = $2
      ORDER BY pr.created_at DESC
    `;
    const res = await pool.query(query, [projectId, tenantId]);
    return res.rows;
  }

  async getPurchaseRequestById(tenantId, projectId, prId) {
    const prQuery = `
      SELECT pr.*, u.name as requested_by_name
      FROM purchase_requests pr
      LEFT JOIN users u ON pr.requested_by = u.id
      WHERE pr.id = $1 AND pr.project_id = $2 AND pr.tenant_id = $3
    `;
    const prRes = await pool.query(prQuery, [prId, projectId, tenantId]);
    if (prRes.rows.length === 0) return null;

    const pr = prRes.rows[0];
    pr.items = await this.getPRItems(pool, tenantId, prId);
    return pr;
  }

  async updatePurchaseRequest(tenantId, userId, projectId, prId, prData) {
    const { requiredByDate, deliveryLocation, notes, status, pmFeedback } = prData;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      // Check existence
      const prCheck = await client.query(
        'SELECT * FROM purchase_requests WHERE id = $1 AND project_id = $2 AND tenant_id = $3',
        [prId, projectId, tenantId]
      );
      if (prCheck.rows.length === 0) {
        throw new Error('Purchase Request not found');
      }

      const fields = [];
      const values = [tenantId, prId];
      let index = 3;

      if (requiredByDate !== undefined) {
        fields.push(`required_by_date = $${index++}`);
        values.push(requiredByDate);
      }
      if (deliveryLocation !== undefined) {
        fields.push(`delivery_location = $${index++}`);
        values.push(deliveryLocation);
      }
      if (notes !== undefined) {
        fields.push(`notes = $${index++}`);
        values.push(notes);
      }
      if (status !== undefined) {
        fields.push(`status = $${index++}`);
        values.push(status);
      }
      if (pmFeedback !== undefined) {
        fields.push(`pm_feedback = $${index++}`);
        values.push(pmFeedback);
      }

      fields.push(`updated_at = NOW()`);

      const updateQuery = `
        UPDATE purchase_requests
        SET ${fields.join(', ')}
        WHERE id = $2 AND tenant_id = $1
        RETURNING *
      `;
      const res = await client.query(updateQuery, values);
      const updatedPr = res.rows[0];

      await client.query('COMMIT');
      
      updatedPr.items = await this.getPRItems(pool, tenantId, prId);
      return updatedPr;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async convertToPurchaseOrder(tenantId, userId, projectId, prId, poData) {
    const { vendorId } = poData;
    if (!vendorId) {
      throw new Error('Vendor ID is required for creating a Purchase Order');
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Fetch approved purchase request
      const prRes = await client.query(
        "SELECT * FROM purchase_requests WHERE id = $1 AND project_id = $2 AND tenant_id = $3",
        [prId, projectId, tenantId]
      );
      if (prRes.rows.length === 0) {
        throw new Error('Purchase Request not found');
      }
      const pr = prRes.rows[0];
      if (pr.status !== 'approved') {
        throw new Error('Only approved Purchase Requests can be converted to Purchase Orders');
      }

      // 2. Fetch items
      const items = await this.getPRItems(client, tenantId, prId);
      if (items.length === 0) {
        throw new Error('Purchase Request has no items to convert');
      }

      // 3. Create draft Purchase Order
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const poNumber = `PO-${dateStr}-${randomSuffix}`;

      // Fetch default delivery address from project site_address
      const projectRes = await client.query('SELECT site_address FROM projects WHERE id = $1', [projectId]);
      const defaultAddress = projectRes.rows.length > 0 ? projectRes.rows[0].site_address : '';

      const poQuery = `
        INSERT INTO purchase_orders 
        (tenant_id, project_id, vendor_id, po_number, status, expected_delivery_date, notes, total_amount, purchase_request_id, delivery_address)
        VALUES ($1, $2, $3, $4, 'draft', $5, $6, 0.00, $7, $8)
        RETURNING *
      `;
      const poRes = await client.query(poQuery, [
        tenantId,
        projectId,
        vendorId,
        poNumber,
        pr.required_by_date,
        `Generated from PR ${pr.pr_number}. ${pr.notes || ''}`.trim(),
        prId,
        defaultAddress || null
      ]);
      const po = poRes.rows[0];

      // 4. Copy items to PO
      for (const item of items) {
        const itemQuery = `
          INSERT INTO purchase_order_items
          (tenant_id, purchase_order_id, boq_item_id, item_name, description, quantity, unit, unit_price, quantity_received, brand, material_specifications, pr_item_id, material_category)
          VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 0.00, $9, $10, $11, $12)
        `;
        await client.query(itemQuery, [
          tenantId,
          po.id,
          item.boq_item_id,
          item.item_name,
          item.description,
          item.quantity,
          item.unit,
          item.unit_price,
          item.brand,
          item.material_specifications,
          item.id,
          item.material_category || 'general'
        ]);
      }

      // 5. Update total PO amount
      const updatePoAmountRes = await client.query(
        `UPDATE purchase_orders
         SET total_amount = (SELECT COALESCE(SUM(quantity * unit_price), 0.00) FROM purchase_order_items WHERE purchase_order_id = $1)
         WHERE id = $1
         RETURNING *`,
        [po.id]
      );

      // 6. Update PR status to ordered
      await client.query(
        `UPDATE purchase_requests SET status = 'ordered', updated_at = NOW() WHERE id = $1`,
        [prId]
      );

      await client.query('COMMIT');
      return updatePoAmountRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = new PurchaseRequestService();
