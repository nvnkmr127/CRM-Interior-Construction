const pool = require('../../db/pool');
const storage = require('../../utils/storage');
const purchaseOrderService = require('./purchaseOrderService');

class MaterialDeliveryService {
  async createMaterialDelivery(tenantId, userId, projectId, deliveryData) {
    const { purchaseOrderId, expectedDeliveryDate, actualReceiptDate, notes, items } = deliveryData;
    
    // Auto-generate delivery number if not provided
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const deliveryNumber = deliveryData.deliveryNumber || `DN-${dateStr}-${randomSuffix}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Determine status based on items
      let anyDamaged = false;
      let allReceived = true;
      if (Array.isArray(items) && items.length > 0) {
        items.forEach(item => {
          if (item.isDamaged) anyDamaged = true;
          if (parseFloat(item.quantityReceived || 0) < parseFloat(item.quantityExpected || 0)) {
            allReceived = false;
          }
        });
      }

      let status = 'delivered';
      if (anyDamaged) {
        status = 'inspected'; // marked as inspected because damage was logged
      } else if (!allReceived) {
        status = 'partially received';
      }

      // 2. Insert main delivery
      const mdQuery = `
        INSERT INTO material_deliveries 
        (tenant_id, project_id, purchase_order_id, delivery_number, status, expected_delivery_date, actual_receipt_date, received_by, notes)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `;
      const mdRes = await client.query(mdQuery, [
        tenantId,
        projectId,
        purchaseOrderId || null,
        deliveryNumber,
        status,
        expectedDeliveryDate || null,
        actualReceiptDate || new Date(),
        userId,
        notes || null
      ]);
      const delivery = mdRes.rows[0];

      // 3. Insert items
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          const itemQuery = `
            INSERT INTO material_delivery_items
            (tenant_id, material_delivery_id, po_item_id, item_name, quantity_expected, quantity_received, is_damaged, damage_description, condition_notes, photo_key)
            VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
          `;
          await client.query(itemQuery, [
            tenantId,
            delivery.id,
            item.poItemId || null,
            item.itemName,
            item.quantityExpected || 0.00,
            item.quantityReceived || 0.00,
            !!item.isDamaged,
            item.damageDescription || null,
            item.conditionNotes || null,
            item.photoKey || null
          ]);

          // 4. Update the PO item quantity_received if linked
          if (item.poItemId) {
            const sumRes = await client.query(
              `SELECT COALESCE(SUM(quantity_received), 0.00) as total_rec
               FROM material_delivery_items
               WHERE po_item_id = $1 AND tenant_id = $2`,
              [item.poItemId, tenantId]
            );
            const totalRec = parseFloat(sumRes.rows[0].total_rec);

            await client.query(
              `UPDATE purchase_order_items
               SET quantity_received = $1, updated_at = NOW()
               WHERE id = $2 AND tenant_id = $3`,
              [totalRec, item.poItemId, tenantId]
            );
          }
        }
      }

      // 5. Update PO status & budget if linked to a PO
      if (purchaseOrderId) {
        // Fetch PO items to recalculate PO status
        const poItemsRes = await client.query(
          `SELECT id, quantity, quantity_received FROM purchase_order_items WHERE purchase_order_id = $1 AND tenant_id = $2`,
          [purchaseOrderId, tenantId]
        );
        const poItems = poItemsRes.rows;

        let allFullyReceived = true;
        let anyReceived = false;

        for (const pi of poItems) {
          const qty = parseFloat(pi.quantity);
          const rec = parseFloat(pi.quantity_received);
          if (rec > 0) anyReceived = true;
          if (rec < qty) allFullyReceived = false;
        }

        // Fetch PO details to get current status
        const poRes = await client.query('SELECT status FROM purchase_orders WHERE id = $1', [purchaseOrderId]);
        const poStatus = poRes.rows[0]?.status;

        let newStatus = poStatus;
        if (poStatus === 'confirmed' || poStatus === 'partially received' || poStatus === 'received') {
          if (allFullyReceived) {
            newStatus = 'received';
          } else if (anyReceived) {
            newStatus = 'partially received';
          } else {
            newStatus = 'confirmed';
          }
        }

        const poUpdateRes = await client.query(
          `UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
          [newStatus, purchaseOrderId]
        );
        const updatedPo = poUpdateRes.rows[0];

        // Sync with budget system
        await purchaseOrderService.syncBudgetExpenses(client, tenantId, projectId, updatedPo);
      }

      await client.query('COMMIT');

      // Fetch delivery items and sign photos
      delivery.items = await this.getDeliveryItems(client, tenantId, delivery.id);
      return delivery;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async getDeliveryItems(client, tenantId, deliveryId) {
    const query = `
      SELECT mdi.*, poi.brand, poi.material_specifications
      FROM material_delivery_items mdi
      LEFT JOIN purchase_order_items poi ON mdi.po_item_id = poi.id
      WHERE mdi.material_delivery_id = $1 AND mdi.tenant_id = $2
      ORDER BY mdi.created_at ASC
    `;
    const res = await client.query(query, [deliveryId, tenantId]);
    const items = res.rows;
    for (const item of items) {
      if (item.photo_key) {
        try {
          item.photo_url = await storage.getDownloadUrl(item.photo_key);
        } catch (err) {
          console.error('[Delivery Service] Failed to get signed URL for', item.photo_key, err.message);
          item.photo_url = null;
        }
      }
    }
    return items;
  }

  async getMaterialDeliveriesByProject(tenantId, projectId) {
    const query = `
      SELECT md.*, u.name as receiver_name, po.po_number
      FROM material_deliveries md
      LEFT JOIN users u ON md.received_by = u.id
      LEFT JOIN purchase_orders po ON md.purchase_order_id = po.id
      WHERE md.project_id = $1 AND md.tenant_id = $2
      ORDER BY md.actual_receipt_date DESC, md.created_at DESC
    `;
    const res = await pool.query(query, [projectId, tenantId]);
    return res.rows;
  }

  async getMaterialDeliveryById(tenantId, projectId, deliveryId) {
    const query = `
      SELECT md.*, u.name as receiver_name, po.po_number
      FROM material_deliveries md
      LEFT JOIN users u ON md.received_by = u.id
      LEFT JOIN purchase_orders po ON md.purchase_order_id = po.id
      WHERE md.id = $1 AND md.project_id = $2 AND md.tenant_id = $3
    `;
    const res = await pool.query(query, [deliveryId, projectId, tenantId]);
    if (res.rows.length === 0) return null;

    const delivery = res.rows[0];
    delivery.items = await this.getDeliveryItems(pool, tenantId, deliveryId);
    return delivery;
  }

  async updateMaterialDelivery(tenantId, userId, projectId, deliveryId, updateData) {
    const { status, notes, actualReceiptDate } = updateData;
    const client = await pool.connect();
    
    try {
      await client.query('BEGIN');

      const check = await client.query(
        'SELECT * FROM material_deliveries WHERE id = $1 AND project_id = $2 AND tenant_id = $3',
        [deliveryId, projectId, tenantId]
      );
      if (check.rows.length === 0) throw new Error('Material delivery not found');

      const fields = [];
      const values = [tenantId, deliveryId];
      let index = 3;

      if (status !== undefined) {
        fields.push(`status = $${index++}`);
        values.push(status);
      }
      if (notes !== undefined) {
        fields.push(`notes = $${index++}`);
        values.push(notes);
      }
      if (actualReceiptDate !== undefined) {
        fields.push(`actual_receipt_date = $${index++}`);
        values.push(actualReceiptDate);
      }

      fields.push(`updated_at = NOW()`);

      const updateQuery = `
        UPDATE material_deliveries
        SET ${fields.join(', ')}
        WHERE id = $2 AND tenant_id = $1
        RETURNING *
      `;
      const res = await client.query(updateQuery, values);
      const updated = res.rows[0];
 
      await client.query('COMMIT');
      updated.items = await this.getDeliveryItems(pool, tenantId, deliveryId);
      return updated;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
 
  async inspectMaterialDelivery(tenantId, userId, projectId, deliveryId, inspectionData) {
    const { inspectionNotes, items } = inspectionData;
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
 
      const checkRes = await client.query(
        'SELECT * FROM material_deliveries WHERE id = $1 AND project_id = $2 AND tenant_id = $3',
        [deliveryId, projectId, tenantId]
      );
      if (checkRes.rows.length === 0) throw new Error('Material delivery not found');
      const delivery = checkRes.rows[0];
 
      let anyRejected = false;
      let allAcceptedConforming = true;
 
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          const { 
            itemId, 
            quantityReceived, 
            specificationConformanceStatus, 
            specificationVarianceDetails, 
            inspectionStatus, 
            rejectedQuantity, 
            rejectionReason 
          } = item;
 
          if (inspectionStatus === 'rejected') {
            anyRejected = true;
          }
          if (specificationConformanceStatus === 'non-conforming' || inspectionStatus === 'rejected') {
            allAcceptedConforming = false;
          }
 
          await client.query(
            `UPDATE material_delivery_items
             SET quantity_received = $1,
                 specification_conformance_status = $2,
                 specification_variance_details = $3,
                 inspection_status = $4,
                 rejected_quantity = $5,
                 rejection_reason = $6,
                 updated_at = NOW()
             WHERE id = $7 AND tenant_id = $8 AND material_delivery_id = $9`,
            [
              quantityReceived || 0.00,
              specificationConformanceStatus || 'conforming',
              specificationVarianceDetails || null,
              inspectionStatus || 'pending',
              rejectedQuantity || 0.00,
              rejectionReason || null,
              itemId,
              tenantId,
              deliveryId
            ]
          );
 
          const itemRes = await client.query('SELECT po_item_id FROM material_delivery_items WHERE id = $1', [itemId]);
          const poItemId = itemRes.rows[0]?.po_item_id;
          if (poItemId) {
            const sumRes = await client.query(
              `SELECT COALESCE(SUM(quantity_received), 0.00) as total_rec
               FROM material_delivery_items
               WHERE po_item_id = $1 AND tenant_id = $2`,
              [poItemId, tenantId]
            );
            const totalRec = parseFloat(sumRes.rows[0].total_rec);
 
            await client.query(
              `UPDATE purchase_order_items
               SET quantity_received = $1, updated_at = NOW()
               WHERE id = $2 AND tenant_id = $3`,
              [totalRec, poItemId, tenantId]
            );
          }
        }
      }
 
      let finalStatus = 'inspected';
      if (anyRejected) {
        finalStatus = 'rejected';
      } else if (!allAcceptedConforming) {
        finalStatus = 'partially received';
      }
 
      let vendorNotificationSent = false;
      let vendorNotificationSentAt = null;
      if (anyRejected) {
        vendorNotificationSent = true;
        vendorNotificationSentAt = new Date().toISOString();
        console.log(`[Notification Service] ALERT dispatched to Vendor for Purchase Order ${delivery.purchase_order_id || 'N/A'}: Materials rejected during incoming site inspection.`);
      }
 
      const updateQuery = `
        UPDATE material_deliveries
        SET status = $1,
            inspection_date = NOW(),
            inspected_by = $2,
            inspection_notes = $3,
            vendor_notification_sent = $4,
            vendor_notification_sent_at = $5,
            updated_at = NOW()
        WHERE id = $6 AND tenant_id = $7
        RETURNING *
      `;
      const mdUpdateRes = await client.query(updateQuery, [
        finalStatus,
        userId,
        inspectionNotes || null,
        vendorNotificationSent,
        vendorNotificationSentAt,
        deliveryId,
        tenantId
      ]);
      const updatedDelivery = mdUpdateRes.rows[0];
 
      const purchaseOrderId = delivery.purchase_order_id;
      if (purchaseOrderId) {
        const poItemsRes = await client.query(
          `SELECT id, quantity, quantity_received FROM purchase_order_items WHERE purchase_order_id = $1 AND tenant_id = $2`,
          [purchaseOrderId, tenantId]
        );
        const poItems = poItemsRes.rows;
 
        let allFullyReceived = true;
        let anyReceived = false;
 
        for (const pi of poItems) {
          const qty = parseFloat(pi.quantity);
          const rec = parseFloat(pi.quantity_received);
          if (rec > 0) anyReceived = true;
          if (rec < qty) allFullyReceived = false;
        }
 
        const poRes = await client.query('SELECT status FROM purchase_orders WHERE id = $1', [purchaseOrderId]);
        const poStatus = poRes.rows[0]?.status;
 
        let newStatus = poStatus;
        if (poStatus === 'confirmed' || poStatus === 'partially received' || poStatus === 'received') {
          if (allFullyReceived) {
            newStatus = 'received';
          } else if (anyReceived) {
            newStatus = 'partially received';
          } else {
            newStatus = 'confirmed';
          }
        }
 
        const poUpdateRes = await client.query(
          `UPDATE purchase_orders SET status = $1, updated_at = NOW() WHERE id = $2 RETURNING *`,
          [newStatus, purchaseOrderId]
        );
        const updatedPo = poUpdateRes.rows[0];
 
        await purchaseOrderService.syncBudgetExpenses(client, tenantId, projectId, updatedPo);
      }
 
      await client.query('COMMIT');
      updatedDelivery.items = await this.getDeliveryItems(pool, tenantId, deliveryId);
      return updatedDelivery;
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }
}

module.exports = new MaterialDeliveryService();
