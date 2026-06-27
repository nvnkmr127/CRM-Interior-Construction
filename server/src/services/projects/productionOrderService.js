const pool = require('../../db/pool');
const AppError = require('../../utils/AppError');

class ProductionOrderService {
  async createProductionOrder(tenantId, userId, projectId, poData) {
    const { factoryName, expectedCompletionDate, notes, items } = poData;

    // Generate unique order number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const orderNumber = poData.orderNumber || `PROD-${dateStr}-${randomSuffix}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Create main Production Order
      const poQuery = `
        INSERT INTO production_orders 
        (tenant_id, project_id, order_number, status, factory_name, expected_completion_date, notes)
        VALUES ($1, $2, $3, 'draft', $4, $5, $6)
        RETURNING *
      `;
      const poRes = await client.query(poQuery, [
        tenantId,
        projectId,
        orderNumber,
        factoryName || null,
        expectedCompletionDate || null,
        notes || null
      ]);
      const productionOrder = poRes.rows[0];

      // 2. Insert items
      if (Array.isArray(items) && items.length > 0) {
        for (const item of items) {
          let itemName = item.itemName;
          let unit = item.unit;
          let quantity = item.quantity || 1.00;

          // Fetch specifications from BOQ item if boqItemId is provided
          if (item.boqItemId) {
            const boqRes = await client.query(
              'SELECT item_name, unit, quantity FROM quotation_items WHERE id = $1 AND tenant_id = $2',
              [item.boqItemId, tenantId]
            );
            if (boqRes.rows.length > 0) {
              const boqItem = boqRes.rows[0];
              itemName = itemName || boqItem.item_name;
              unit = unit || boqItem.unit;
              if (item.quantity === undefined) {
                quantity = boqItem.quantity;
              }
            }
          }

          const itemQuery = `
            INSERT INTO production_order_items
            (tenant_id, production_order_id, boq_item_id, item_name, quantity, unit, factory_assignment, status, qc_status, packaging_status)
            VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'pending', 'pending')
          `;
          await client.query(itemQuery, [
            tenantId,
            productionOrder.id,
            item.boqItemId || null,
            itemName,
            quantity,
            unit || null,
            item.factoryAssignment || factoryName || null
          ]);
        }
      }

      await client.query('COMMIT');

      // Return the complete production order with items
      return this.getProductionOrderById(tenantId, projectId, productionOrder.id);
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async getProductionOrdersByProject(tenantId, projectId) {
    // Return all production orders with their item counts and progress
    const query = `
      SELECT po.*,
             COALESCE(COUNT(poi.id), 0) as total_items,
             COALESCE(SUM(CASE WHEN poi.status = 'completed' THEN 1 ELSE 0 END), 0) as completed_items
      FROM production_orders po
      LEFT JOIN production_order_items poi ON po.id = poi.production_order_id
      WHERE po.project_id = $1 AND po.tenant_id = $2
      GROUP BY po.id
      ORDER BY po.created_at DESC
    `;
    const res = await pool.query(query, [projectId, tenantId]);
    return res.rows;
  }

  async getProductionOrderById(tenantId, projectId, id) {
    const poRes = await pool.query(
      'SELECT * FROM production_orders WHERE id = $1 AND project_id = $2 AND tenant_id = $3',
      [id, projectId, tenantId]
    );
    if (poRes.rows.length === 0) return null;

    const po = poRes.rows[0];
    const itemsRes = await pool.query(
      'SELECT * FROM production_order_items WHERE production_order_id = $1 AND tenant_id = $2 ORDER BY created_at ASC',
      [id, tenantId]
    );
    po.items = itemsRes.rows;
    return po;
  }

  async updateProductionOrder(tenantId, projectId, id, poData) {
    const { status, factoryName, expectedCompletionDate, notes } = poData;
    
    const query = `
      UPDATE production_orders
      SET status = COALESCE($1, status),
          factory_name = COALESCE($2, factory_name),
          expected_completion_date = COALESCE($3, expected_completion_date),
          notes = COALESCE($4, notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND project_id = $6 AND tenant_id = $7
      RETURNING *
    `;
    const res = await pool.query(query, [
      status !== undefined ? status : null,
      factoryName !== undefined ? factoryName : null,
      expectedCompletionDate !== undefined ? expectedCompletionDate : null,
      notes !== undefined ? notes : null,
      id,
      projectId,
      tenantId
    ]);
    
    if (res.rows.length === 0) return null;
    return this.getProductionOrderById(tenantId, projectId, id);
  }

  async updateProductionOrderItem(tenantId, projectId, orderId, itemId, itemData) {
    const {
      factoryAssignment,
      status,
      productionStartDate,
      productionCompleteDate,
      qcStatus,
      packagingStatus,
      dispatchDate
    } = itemData;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify the item belongs to the order and tenant
      const itemCheck = await client.query(
        `SELECT poi.* FROM production_order_items poi
         JOIN production_orders po ON poi.production_order_id = po.id
         WHERE poi.id = $1 AND poi.production_order_id = $2 AND po.project_id = $3 AND poi.tenant_id = $4`,
        [itemId, orderId, projectId, tenantId]
      );
      if (itemCheck.rows.length === 0) {
        throw new Error('Production Order Item not found');
      }

      // Update the item
      const updateItemQuery = `
        UPDATE production_order_items
        SET factory_assignment = COALESCE($1, factory_assignment),
            status = COALESCE($2, status),
            production_start_date = COALESCE($3, production_start_date),
            production_complete_date = COALESCE($4, production_complete_date),
            qc_status = COALESCE($5, qc_status),
            packaging_status = COALESCE($6, packaging_status),
            dispatch_date = COALESCE($7, dispatch_date),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $8 AND tenant_id = $9
        RETURNING *
      `;
      const updateRes = await client.query(updateItemQuery, [
        factoryAssignment !== undefined ? factoryAssignment : null,
        status !== undefined ? status : null,
        productionStartDate !== undefined ? productionStartDate : null,
        productionCompleteDate !== undefined ? productionCompleteDate : null,
        qcStatus !== undefined ? qcStatus : null,
        packagingStatus !== undefined ? packagingStatus : null,
        dispatchDate !== undefined ? dispatchDate : null,
        itemId,
        tenantId
      ]);

      // Automatically update the parent order status based on item statuses
      const allItemsRes = await client.query(
        'SELECT status FROM production_order_items WHERE production_order_id = $1 AND tenant_id = $2',
        [orderId, tenantId]
      );
      
      const itemStatuses = allItemsRes.rows.map(r => r.status);
      let newOrderStatus = 'in_production';
      
      if (itemStatuses.every(s => s === 'completed')) {
        newOrderStatus = 'completed';
      } else if (itemStatuses.every(s => s === 'pending')) {
        newOrderStatus = 'scheduled';
      } else if (itemStatuses.includes('cancelled') && itemStatuses.every(s => s === 'completed' || s === 'cancelled')) {
        newOrderStatus = 'completed';
      }

      await client.query(
        'UPDATE production_orders SET status = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3',
        [newOrderStatus, orderId, tenantId]
      );

      await client.query('COMMIT');
      return updateRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async recordQCInspection(tenantId, userId, projectId, orderId, itemId, data) {
    const { status, notes, photoKeys } = data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verify item context
      const itemCheck = await client.query(
        `SELECT poi.* FROM production_order_items poi
         JOIN production_orders po ON poi.production_order_id = po.id
         WHERE poi.id = $1 AND poi.production_order_id = $2 AND po.project_id = $3 AND poi.tenant_id = $4`,
        [itemId, orderId, projectId, tenantId]
      );
      if (itemCheck.rows.length === 0) {
        throw new Error('Production Order Item not found');
      }

      // 2. Insert inspection record
      const insertQuery = `
        INSERT INTO production_qc_inspections 
        (tenant_id, production_order_item_id, inspected_by, status, notes, photo_keys)
        VALUES ($1, $2, $3, $4, $5, $6)
        RETURNING *
      `;
      const inspectionRes = await client.query(insertQuery, [
        tenantId,
        itemId,
        userId,
        status,
        notes || null,
        JSON.stringify(photoKeys || [])
      ]);
      const inspection = inspectionRes.rows[0];

      // 3. Update item QC status
      await client.query(
        `UPDATE production_order_items 
         SET qc_status = $1, updated_at = CURRENT_TIMESTAMP 
         WHERE id = $2 AND tenant_id = $3`,
        [status, itemId, tenantId]
      );

      // 4. Enforce dispatch gate auto-reset if any item failed QC
      if (status === 'failed') {
        await client.query(
          `UPDATE production_orders 
           SET is_cleared_for_dispatch = false, cleared_by = null, cleared_at = null, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND tenant_id = $2`,
          [orderId, tenantId]
        );
      }

      await client.query('COMMIT');
      return inspection;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async createReworkOrder(tenantId, userId, projectId, orderId, itemId, data) {
    const { reworkInstructions, assignedTo, targetDate } = data;

    // Generate unique rework number
    const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
    const randomSuffix = Math.floor(1000 + Math.random() * 9000);
    const reworkNumber = `RWK-${dateStr}-${randomSuffix}`;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verify item fails or has failed inspection
      const itemCheck = await client.query(
        `SELECT poi.* FROM production_order_items poi
         JOIN production_orders po ON poi.production_order_id = po.id
         WHERE poi.id = $1 AND poi.production_order_id = $2 AND po.project_id = $3 AND poi.tenant_id = $4`,
        [itemId, orderId, projectId, tenantId]
      );
      if (itemCheck.rows.length === 0) {
        throw new Error('Production Order Item not found');
      }

      // Fetch latest inspection id if any
      const inspectionRes = await client.query(
        `SELECT id FROM production_qc_inspections 
         WHERE production_order_item_id = $1 AND tenant_id = $2
         ORDER BY created_at DESC LIMIT 1`,
        [itemId, tenantId]
      );
      const qcInspectionId = inspectionRes.rows.length > 0 ? inspectionRes.rows[0].id : null;

      // 2. Insert Rework Order
      const insertQuery = `
        INSERT INTO production_rework_orders
        (tenant_id, production_order_item_id, qc_inspection_id, rework_number, rework_instructions, status, assigned_to, target_date)
        VALUES ($1, $2, $3, $4, $5, 'assigned', $6, $7)
        RETURNING *
      `;
      const rwRes = await client.query(insertQuery, [
        tenantId,
        itemId,
        qcInspectionId,
        reworkNumber,
        reworkInstructions,
        assignedTo || null,
        targetDate || null
      ]);
      const rework = rwRes.rows[0];

      // 3. Set item production status to in_production so factory re-manufactures it
      await client.query(
        `UPDATE production_order_items
         SET status = 'in_production', updated_at = CURRENT_TIMESTAMP
         WHERE id = $1 AND tenant_id = $2`,
        [itemId, tenantId]
      );

      await client.query('COMMIT');
      return rework;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateReworkOrderStatus(tenantId, projectId, orderId, reworkId, data) {
    const { status } = data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // Verify rework order context
      const rwCheck = await client.query(
        `SELECT pro.*, pro.production_order_item_id FROM production_rework_orders pro
         JOIN production_order_items poi ON pro.production_order_item_id = poi.id
         JOIN production_orders po ON poi.production_order_id = po.id
         WHERE pro.id = $1 AND poi.production_order_id = $2 AND po.project_id = $3 AND pro.tenant_id = $4`,
        [reworkId, orderId, projectId, tenantId]
      );
      if (rwCheck.rows.length === 0) {
        throw new Error('Rework Order not found');
      }
      
      const reworkOrder = rwCheck.rows[0];
      const itemId = reworkOrder.production_order_item_id;

      // Update Rework Order
      let completedAt = null;
      if (status === 'completed' || status === 'verified') {
        completedAt = new Date().toISOString();
      }

      const updateQuery = `
        UPDATE production_rework_orders
        SET status = $1,
            completed_at = COALESCE($2, completed_at),
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $3 AND tenant_id = $4
        RETURNING *
      `;
      const rwRes = await client.query(updateQuery, [status, completedAt, reworkId, tenantId]);

      // If status is verified, automatically mark item as completed and QC status as passed
      if (status === 'verified') {
        await client.query(
          `UPDATE production_order_items
           SET status = 'completed', qc_status = 'passed', production_complete_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND tenant_id = $2`,
          [itemId, tenantId]
        );
      } else if (status === 'completed') {
        // If completed, item can be marked as completed but remains pending inspection
        await client.query(
          `UPDATE production_order_items
           SET status = 'completed', qc_status = 'pending', production_complete_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
           WHERE id = $1 AND tenant_id = $2`,
          [itemId, tenantId]
        );
      }

      await client.query('COMMIT');
      return rwRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async clearOrderForDispatch(tenantId, userId, projectId, orderId) {
    // 1. Get all items in the order
    const itemsRes = await pool.query(
      'SELECT id, item_name, qc_status FROM production_order_items WHERE production_order_id = $1 AND tenant_id = $2',
      [orderId, tenantId]
    );

    const items = itemsRes.rows;
    if (items.length === 0) {
      throw new AppError('Production Order contains no items', 400);
    }

    // 2. Validate all items have qc_status = 'passed'
    const unpassedItems = items.filter(item => item.qc_status !== 'passed');
    if (unpassedItems.length > 0) {
      const names = unpassedItems.map(i => i.item_name).join(', ');
      throw new AppError(`Cannot clear for dispatch. The following items have not passed QC: ${names}`, 400, 'DISPATCH_QC_FAILED');
    }

    // 3. Clear for dispatch
    const updateRes = await pool.query(
      `UPDATE production_orders
       SET is_cleared_for_dispatch = true,
           cleared_by = $1,
           cleared_at = CURRENT_TIMESTAMP,
           updated_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND project_id = $3 AND tenant_id = $4
       RETURNING *`,
      [userId, orderId, projectId, tenantId]
    );

    if (updateRes.rows.length === 0) {
      throw new Error('Production Order not found');
    }

    return this.getProductionOrderById(tenantId, projectId, orderId);
  }

  async getQCAndReworkSummary(tenantId, projectId, orderId) {
    // 1. Get all QC Inspections for the order's items
    const inspectionsQuery = `
      SELECT pqi.*, poi.item_name, u.name as inspector_name
      FROM production_qc_inspections pqi
      JOIN production_order_items poi ON pqi.production_order_item_id = poi.id
      LEFT JOIN users u ON pqi.inspected_by = u.id
      WHERE poi.production_order_id = $1 AND pqi.tenant_id = $2
      ORDER BY pqi.created_at DESC
    `;
    const inspectionsRes = await pool.query(inspectionsQuery, [orderId, tenantId]);

    // 2. Get all Rework Orders for the order's items
    const reworksQuery = `
      SELECT pro.*, poi.item_name
      FROM production_rework_orders pro
      JOIN production_order_items poi ON pro.production_order_item_id = poi.id
      WHERE poi.production_order_id = $1 AND pro.tenant_id = $2
      ORDER BY pro.created_at DESC
    `;
    const reworksRes = await pool.query(reworksQuery, [orderId, tenantId]);

    return {
      inspections: inspectionsRes.rows,
      reworkOrders: reworksRes.rows
    };
  }

  async dispatchProductionOrder(tenantId, userId, projectId, orderId, data) {
    const { vehicleNumber, driverName, driverContact, expectedDeliveryDate } = data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verify production order clearance gate
      const poCheck = await client.query(
        'SELECT * FROM production_orders WHERE id = $1 AND project_id = $2 AND tenant_id = $3',
        [orderId, projectId, tenantId]
      );
      if (poCheck.rows.length === 0) {
        throw new AppError('Production Order not found', 404);
      }

      const order = poCheck.rows[0];
      if (!order.is_cleared_for_dispatch) {
        throw new AppError('Cannot dispatch production order. It must pass the Quality Control (QC) clearance gate first.', 400, 'DISPATCH_CLEARANCE_REQUIRED');
      }

      // Generate unique dispatch number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const dispatchNumber = `DSP-${dateStr}-${randomSuffix}`;

      // 2. Insert dispatch detail
      const insertQuery = `
        INSERT INTO production_dispatches
        (tenant_id, project_id, production_order_id, dispatch_number, vehicle_number, driver_name, driver_contact, expected_delivery_date, status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, 'in_transit')
        RETURNING *
      `;
      const dispatchRes = await client.query(insertQuery, [
        tenantId,
        projectId,
        orderId,
        dispatchNumber,
        vehicleNumber || null,
        driverName || null,
        driverContact || null,
        expectedDeliveryDate || null
      ]);

      // 3. Mark items as dispatched and set dispatch date
      await client.query(
        `UPDATE production_order_items
         SET packaging_status = 'dispatched', dispatch_date = CURRENT_TIMESTAMP, updated_at = CURRENT_TIMESTAMP
         WHERE production_order_id = $1 AND tenant_id = $2`,
        [orderId, tenantId]
      );

      await client.query('COMMIT');
      const dispatch = dispatchRes.rows[0];

      // Send notifications (async / non-blocking)
      setImmediate(async () => {
        try {
          const { notifyUser } = require('../notificationService');
          const { sendWhatsAppMessage } = require('../whatsappService');
          const { notificationQueue } = require('../../queues/queueSetup');

          // Fetch Project and PM details
          const projQuery = `
            SELECT p.name, p.pm_id, u.name as pm_name, u.email as pm_email
            FROM projects p
            LEFT JOIN users u ON p.pm_id = u.id
            WHERE p.id = $1 AND p.tenant_id = $2
          `;
          const projRes = await pool.query(projQuery, [projectId, tenantId]);
          const project = projRes.rows[0];

          if (project) {
            const expectedDateStr = expectedDeliveryDate 
              ? new Date(expectedDeliveryDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
              : 'N/A';
            const vehicle = vehicleNumber || 'N/A';
            const driver = driverName ? `${driverName} (${driverContact || 'N/A'})` : 'N/A';

            // Fetch active supervisors
            const supQuery = `
              SELECT name, email, phone 
              FROM project_site_team
              WHERE project_id = $1 AND tenant_id = $2 AND role = 'supervisor' AND status = 'active'
            `;
            const supRes = await pool.query(supQuery, [projectId, tenantId]);
            const supervisors = supRes.rows;

            // PM messages
            const pmInAppMsg = `Production order ${dispatch.dispatch_number} for project "${project.name}" has been dispatched. Status: In Transit.`;
            const pmEmailMsg = `Dear ${project.pm_name || 'Project Manager'},\n\nPlease note that the materials under dispatch number ${dispatch.dispatch_number} for project "${project.name}" have been dispatched.\nExpected Delivery: ${expectedDateStr}\nVehicle: ${vehicle}\nDriver: ${driver}\n\nBest regards,\nCRM Logistics Team`;

            // Notify PM In-App
            if (project.pm_id) {
              notifyUser({
                tenantId,
                userId: project.pm_id,
                type: 'material_dispatch',
                message: pmInAppMsg,
                referenceUrl: `/projects/${projectId}/production-orders/${orderId}`
              });
            }

            // Notify PM Email
            if (project.pm_email) {
              await notificationQueue.add('dispatchNotification', {
                type: 'email',
                recipientId: project.pm_name || 'Project Manager',
                email: project.pm_email,
                message: pmEmailMsg
              });
            }

            // Notify Supervisors
            for (const supervisor of supervisors) {
              // Supervisor Email
              if (supervisor.email) {
                const supEmailMsg = `Dear ${supervisor.name},\n\nPlease note that modular materials for project "${project.name}" are dispatched and in transit.\nExpected Delivery: ${expectedDateStr}\nVehicle: ${vehicle}\nDriver: ${driver}\n\nPlease ensure site readiness and labor availability for unloading.\n\nBest regards,\nCRM Logistics Team`;
                await notificationQueue.add('dispatchNotification', {
                  type: 'email',
                  recipientId: supervisor.name,
                  email: supervisor.email,
                  message: supEmailMsg
                });
              }

              // Supervisor WhatsApp
              if (supervisor.phone) {
                const supWaMsg = `Material dispatch alert: Production order ${dispatch.dispatch_number} for project "${project.name}" is in transit. Vehicle: ${vehicle}. Driver: ${driver}. Expected: ${expectedDateStr}. Please prepare site.`;
                await sendWhatsAppMessage(supervisor.phone, supWaMsg);
              }
            }
          }
        } catch (err) {
          console.error('[ProductionOrderService] Error sending dispatch notifications:', err.message);
        }
      });

      return dispatch;
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async confirmSiteDelivery(tenantId, userId, projectId, orderId, dispatchId, data) {
    const { receivedByName, receiptNotes } = data;

    const query = `
      UPDATE production_dispatches
      SET status = 'delivered',
          actual_delivery_date = CURRENT_TIMESTAMP,
          received_by_user_id = $1,
          received_by_name = $2,
          receipt_notes = $3,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND production_order_id = $5 AND project_id = $6 AND tenant_id = $7
      RETURNING *
    `;
    const res = await pool.query(query, [
      userId,
      receivedByName || null,
      receiptNotes || null,
      dispatchId,
      orderId,
      projectId,
      tenantId
    ]);

    if (res.rows.length === 0) {
      throw new AppError('Dispatch record not found', 404);
    }
    
    // Send notifications (async / non-blocking)
    const dispatch = res.rows[0];
    setImmediate(async () => {
      try {
        const { notifyUser } = require('../notificationService');
        const { sendWhatsAppMessage } = require('../whatsappService');
        const { notificationQueue } = require('../../queues/queueSetup');

        // Fetch Project and PM details
        const projQuery = `
          SELECT p.name, p.pm_id, u.name as pm_name, u.email as pm_email
          FROM projects p
          LEFT JOIN users u ON p.pm_id = u.id
          WHERE p.id = $1 AND p.tenant_id = $2
        `;
        const projRes = await pool.query(projQuery, [projectId, tenantId]);
        const project = projRes.rows[0];

        if (project && dispatch) {
          const recName = receivedByName || 'Site Supervisor';
          const notesStr = receiptNotes || 'No notes provided';

          // Fetch active supervisors
          const supQuery = `
            SELECT name, email, phone 
            FROM project_site_team
            WHERE project_id = $1 AND tenant_id = $2 AND role = 'supervisor' AND status = 'active'
          `;
          const supRes = await pool.query(supQuery, [projectId, tenantId]);
          const supervisors = supRes.rows;

          // PM messages
          const pmInAppMsg = `Production order ${dispatch.dispatch_number} for project "${project.name}" has arrived and delivery is confirmed.`;
          const pmEmailMsg = `Dear ${project.pm_name || 'Project Manager'},\n\nWe are pleased to inform you that the materials under dispatch number ${dispatch.dispatch_number} for project "${project.name}" have arrived on site and delivery has been confirmed.\nReceived By: ${recName}\nReceipt Notes: ${notesStr}\n\nBest regards,\nCRM Logistics Team`;

          // Notify PM In-App
          if (project.pm_id) {
            notifyUser({
              tenantId,
              userId: project.pm_id,
              type: 'material_delivery',
              message: pmInAppMsg,
              referenceUrl: `/projects/${projectId}/production-orders/${orderId}`
            });
          }

          // Notify PM Email
          if (project.pm_email) {
            await notificationQueue.add('deliveryNotification', {
              type: 'email',
              recipientId: project.pm_name || 'Project Manager',
              email: project.pm_email,
              message: pmEmailMsg
            });
          }

          // Notify Supervisors
          for (const supervisor of supervisors) {
            // Supervisor Email
            if (supervisor.email) {
              const supEmailMsg = `Dear ${supervisor.name},\n\nDelivery of materials under dispatch number ${dispatch.dispatch_number} for project "${project.name}" has been confirmed.\nReceived By: ${recName}\nNotes: ${notesStr}\n\nBest regards,\nCRM Logistics Team`;
              await notificationQueue.add('deliveryNotification', {
                type: 'email',
                recipientId: supervisor.name,
                email: supervisor.email,
                message: supEmailMsg
              });
            }

            // Supervisor WhatsApp
            if (supervisor.phone) {
              const supWaMsg = `Delivery confirmed: Materials under dispatch ${dispatch.dispatch_number} for project "${project.name}" have been delivered and received. Received by: ${recName}. Notes: ${notesStr}.`;
              await sendWhatsAppMessage(supervisor.phone, supWaMsg);
            }
          }
        }
      } catch (err) {
        console.error('[ProductionOrderService] Error sending delivery notifications:', err.message);
      }
    });

    return dispatch;
  }

  async getDispatchRecords(tenantId, projectId, orderId) {
    const query = `
      SELECT pd.*, u.name as receiver_user_name
      FROM production_dispatches pd
      LEFT JOIN users u ON pd.received_by_user_id = u.id
      WHERE pd.production_order_id = $1 AND pd.project_id = $2 AND pd.tenant_id = $3
      ORDER BY pd.created_at DESC
    `;
    const res = await pool.query(query, [orderId, projectId, tenantId]);
    return res.rows;
  }

  async createTransitDamageReport(tenantId, userId, projectId, dispatchId, itemId, data) {
    const { quantityDamaged, damageSeverity, liabilityType, description, photoKeys, resolutionTimeline } = data;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // 1. Verify dispatch and item exist and belong to the project
      const dispatchCheck = await client.query(
        `SELECT pd.*, poi.quantity as shipped_qty, poi.item_name FROM production_dispatches pd
         JOIN production_order_items poi ON pd.production_order_id = poi.production_order_id
         WHERE pd.id = $1 AND poi.id = $2 AND pd.project_id = $3 AND pd.tenant_id = $4`,
        [dispatchId, itemId, projectId, tenantId]
      );
      if (dispatchCheck.rows.length === 0) {
        throw new AppError('Production dispatch or item not found for the specified project.', 404);
      }

      const dispatchItem = dispatchCheck.rows[0];

      // Validate quantity damaged is not greater than shipped quantity
      if (parseFloat(quantityDamaged) > parseFloat(dispatchItem.shipped_qty)) {
        throw new AppError(`Cannot report transit damage for quantity (${quantityDamaged}) greater than shipped quantity (${dispatchItem.shipped_qty}).`, 400, 'INVALID_DAMAGE_QUANTITY');
      }

      // Generate unique damage report number
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const damageNumber = `DMG-${dateStr}-${randomSuffix}`;

      // 2. Insert transit damage record
      const insertQuery = `
        INSERT INTO production_transit_damages
        (tenant_id, project_id, production_dispatch_id, production_order_item_id, damage_number, reported_by, quantity_damaged, damage_severity, liability_type, status, description, photo_keys, resolution_timeline)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, 'reported', $10, $11, $12)
        RETURNING *
      `;
      const insertRes = await client.query(insertQuery, [
        tenantId,
        projectId,
        dispatchId,
        itemId,
        damageNumber,
        userId,
        quantityDamaged || 1.00,
        damageSeverity,
        liabilityType || 'undetermined',
        description,
        JSON.stringify(photoKeys || []),
        resolutionTimeline || null
      ]);

      await client.query('COMMIT');
      return insertRes.rows[0];
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async initiateReplacementOrder(tenantId, userId, projectId, damageId) {
    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const query = `
        SELECT ptd.*, poi.boq_item_id, poi.item_name, poi.unit, po.order_number as original_order_number, po.factory_name
        FROM production_transit_damages ptd
        JOIN production_order_items poi ON ptd.production_order_item_id = poi.id
        JOIN production_dispatches pd ON ptd.production_dispatch_id = pd.id
        JOIN production_orders po ON pd.production_order_id = po.id
        WHERE ptd.id = $1 AND ptd.project_id = $2 AND ptd.tenant_id = $3
      `;
      const damageRes = await client.query(query, [damageId, projectId, tenantId]);
      if (damageRes.rows.length === 0) {
        throw new AppError('Transit damage report not found.', 404);
      }

      const damage = damageRes.rows[0];
      if (damage.replacement_order_id) {
        throw new AppError('Replacement order has already been initiated for this damage report.', 400, 'REPLACEMENT_ALREADY_INITIATED');
      }

      // 2. Spawn a new production order
      const dateStr = new Date().toISOString().slice(0, 10).replace(/-/g, '');
      const randomSuffix = Math.floor(1000 + Math.random() * 9000);
      const newOrderNumber = `REPL-${damage.original_order_number}-${randomSuffix}`;

      const poQuery = `
        INSERT INTO production_orders 
        (tenant_id, project_id, order_number, status, factory_name, expected_completion_date, notes)
        VALUES ($1, $2, $3, 'scheduled', $4, $5, $6)
        RETURNING *
      `;
      const poRes = await client.query(poQuery, [
        tenantId,
        projectId,
        newOrderNumber,
        damage.factory_name || null,
        new Date(Date.now() + 7 * 86400000).toISOString(),
        `Replacement order spawned automatically for transit damage report: ${damage.damage_number}. Reason: ${damage.description}`
      ]);
      const newOrder = poRes.rows[0];

      // 3. Insert items into the new production order
      const itemQuery = `
        INSERT INTO production_order_items
        (tenant_id, production_order_id, boq_item_id, item_name, quantity, unit, factory_assignment, status, qc_status, packaging_status)
        VALUES ($1, $2, $3, $4, $5, $6, $7, 'pending', 'pending', 'pending')
        RETURNING *
      `;
      await client.query(itemQuery, [
        tenantId,
        newOrder.id,
        damage.boq_item_id,
        `[Replacement] ${damage.item_name}`,
        damage.quantity_damaged,
        damage.unit,
        damage.factory_name
      ]);

      // 4. Update the transit damage record
      const updateDmgQuery = `
        UPDATE production_transit_damages
        SET replacement_order_id = $1,
            status = 'replacement_initiated',
            updated_at = CURRENT_TIMESTAMP
        WHERE id = $2 AND tenant_id = $3
        RETURNING *
      `;
      const updateDmgRes = await client.query(updateDmgQuery, [newOrder.id, damageId, tenantId]);

      await client.query('COMMIT');
      return {
        damageReport: updateDmgRes.rows[0],
        replacementOrder: newOrder
      };
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  }

  async updateTransitDamageStatus(tenantId, projectId, damageId, data) {
    const { status, liabilityType, resolutionTimeline, resolutionNotes } = data;

    const query = `
      UPDATE production_transit_damages
      SET status = COALESCE($1, status),
          liability_type = COALESCE($2, liability_type),
          resolution_timeline = COALESCE($3, resolution_timeline),
          resolution_notes = COALESCE($4, resolution_notes),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $5 AND project_id = $6 AND tenant_id = $7
      RETURNING *
    `;
    const res = await pool.query(query, [
      status !== undefined ? status : null,
      liabilityType !== undefined ? liabilityType : null,
      resolutionTimeline !== undefined ? resolutionTimeline : null,
      resolutionNotes !== undefined ? resolutionNotes : null,
      damageId,
      projectId,
      tenantId
    ]);

    if (res.rows.length === 0) {
      throw new AppError('Transit damage report not found.', 404);
    }
    return res.rows[0];
  }

  async getTransitDamageRecords(tenantId, projectId, orderId) {
    let query = `
      SELECT ptd.*, 
             poi.item_name, 
             poi.unit,
             pd.dispatch_number,
             po.order_number,
             u.name as reported_by_name,
             ro.order_number as replacement_order_number
      FROM production_transit_damages ptd
      JOIN production_order_items poi ON ptd.production_order_item_id = poi.id
      JOIN production_dispatches pd ON ptd.production_dispatch_id = pd.id
      JOIN production_orders po ON pd.production_order_id = po.id
      LEFT JOIN users u ON ptd.reported_by = u.id
      LEFT JOIN production_orders ro ON ptd.replacement_order_id = ro.id
      WHERE ptd.project_id = $1 AND ptd.tenant_id = $2
    `;
    const params = [projectId, tenantId];

    if (orderId) {
      query += ` AND pd.production_order_id = $3`;
      params.push(orderId);
    }

    query += ` ORDER BY ptd.created_at DESC`;

    const res = await pool.query(query, params);
    return res.rows;
  }
}

module.exports = new ProductionOrderService();

