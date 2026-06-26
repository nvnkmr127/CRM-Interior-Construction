const pool = require('../../db/pool');

class VendorPaymentService {
  async createVendorPaymentMilestone(tenantId, projectId, milestoneData) {
    const { vendorId, purchaseOrderId, materialDeliveryId, name, amount, percentage, dueDate, notes } = milestoneData;
    
    let finalAmount = Number(amount) || 0.00;

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      // If percentage is provided and linked to a PO, calculate the final amount dynamically
      if (percentage !== undefined && purchaseOrderId) {
        const poRes = await client.query(
          'SELECT total_amount FROM purchase_orders WHERE id = $1 AND tenant_id = $2',
          [purchaseOrderId, tenantId]
        );
        if (poRes.rows.length > 0) {
          const poTotal = parseFloat(poRes.rows[0].total_amount);
          finalAmount = poTotal * (Number(percentage) / 100.0);
        }
      }

      // Initial status checks
      let status = 'scheduled';
      const today = new Date().toISOString().slice(0, 10);
      if (dueDate && dueDate < today) {
        status = 'overdue';
      }

      const insertQuery = `
        INSERT INTO vendor_payment_milestones
        (tenant_id, project_id, vendor_id, purchase_order_id, material_delivery_id, name, amount, percentage, due_date, status, paid_amount)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, 0.00)
        RETURNING *
      `;
      const res = await client.query(insertQuery, [
        tenantId,
        projectId,
        vendorId,
        purchaseOrderId || null,
        materialDeliveryId || null,
        name,
        finalAmount,
        percentage !== undefined ? Number(percentage) : null,
        dueDate || null,
        status
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

  async getVendorPaymentMilestonesByProject(tenantId, projectId) {
    const query = `
      SELECT vpm.*, v.vendor_name, po.po_number, md.delivery_number
      FROM vendor_payment_milestones vpm
      JOIN project_vendors v ON vpm.vendor_id = v.id
      LEFT JOIN purchase_orders po ON vpm.purchase_order_id = po.id
      LEFT JOIN material_deliveries md ON vpm.material_delivery_id = md.id
      WHERE vpm.project_id = $1 AND vpm.tenant_id = $2
      ORDER BY vpm.due_date ASC, vpm.created_at DESC
    `;
    const res = await pool.query(query, [projectId, tenantId]);
    
    // Proactively check and update overdue statuses for display
    const today = new Date().toISOString().slice(0, 10);
    const milestones = res.rows.map(m => {
      if (m.status === 'scheduled' && m.due_date && new Date(m.due_date).toISOString().slice(0, 10) < today) {
        m.status = 'overdue';
      }
      return m;
    });

    return milestones;
  }

  async getVendorPaymentMilestoneById(tenantId, projectId, milestoneId) {
    const query = `
      SELECT vpm.*, v.vendor_name, po.po_number, md.delivery_number
      FROM vendor_payment_milestones vpm
      JOIN project_vendors v ON vpm.vendor_id = v.id
      LEFT JOIN purchase_orders po ON vpm.purchase_order_id = po.id
      LEFT JOIN material_deliveries md ON vpm.material_delivery_id = md.id
      WHERE vpm.id = $1 AND vpm.project_id = $2 AND vpm.tenant_id = $3
    `;
    const res = await pool.query(query, [milestoneId, projectId, tenantId]);
    if (res.rows.length === 0) return null;
    return res.rows[0];
  }

  async updateVendorPaymentMilestone(tenantId, userId, projectId, milestoneId, updateData) {
    const { paidAmount, paidAt, invoiceReference, paymentMethod, notes, status, dueDate, name, amount } = updateData;
    const client = await pool.connect();

    try {
      await client.query('BEGIN');

      const checkRes = await client.query(
        'SELECT * FROM vendor_payment_milestones WHERE id = $1 AND project_id = $2 AND tenant_id = $3',
        [milestoneId, projectId, tenantId]
      );
      if (checkRes.rows.length === 0) throw new Error('Vendor payment milestone not found');
      const existing = checkRes.rows[0];

      const fields = [];
      const values = [tenantId, milestoneId];
      let index = 3;

      if (name !== undefined) {
        fields.push(`name = $${index++}`);
        values.push(name);
      }
      if (amount !== undefined) {
        fields.push(`amount = $${index++}`);
        values.push(Number(amount));
      }
      if (dueDate !== undefined) {
        fields.push(`due_date = $${index++}`);
        values.push(dueDate);
      }
      if (invoiceReference !== undefined) {
        fields.push(`invoice_reference = $${index++}`);
        values.push(invoiceReference);
      }
      if (paymentMethod !== undefined) {
        fields.push(`payment_method = $${index++}`);
        values.push(paymentMethod);
      }
      if (notes !== undefined) {
        fields.push(`notes = $${index++}`);
        values.push(notes);
      }
      if (paidAt !== undefined) {
        fields.push(`paid_at = $${index++}`);
        values.push(paidAt);
      }

      // Check recalculation of paid amount and status
      let finalPaidAmount = existing.paid_amount;
      if (paidAmount !== undefined) {
        finalPaidAmount = Number(paidAmount);
        fields.push(`paid_amount = $${index++}`);
        values.push(finalPaidAmount);
      }

      let finalAmount = amount !== undefined ? Number(amount) : Number(existing.amount);

      let finalStatus = status;
      if (finalStatus === undefined) {
        if (finalPaidAmount >= finalAmount) {
          finalStatus = 'paid';
        } else if (finalPaidAmount > 0) {
          finalStatus = 'partially paid';
        } else {
          // Check if overdue
          const finalDueDate = dueDate !== undefined ? dueDate : existing.due_date;
          const today = new Date().toISOString().slice(0, 10);
          if (finalDueDate && new Date(finalDueDate).toISOString().slice(0, 10) < today) {
            finalStatus = 'overdue';
          } else {
            finalStatus = 'scheduled';
          }
        }
      }

      fields.push(`status = $${index++}`);
      values.push(finalStatus);
      fields.push(`updated_at = NOW()`);

      const query = `
        UPDATE vendor_payment_milestones
        SET ${fields.join(', ')}
        WHERE id = $2 AND tenant_id = $1
        RETURNING *
      `;
      const updateRes = await client.query(query, values);
      
      await client.query('COMMIT');
      return updateRes.rows[0];
    } catch (err) {
      await client.query('ROLLBACK');
      throw err;
    } finally {
      client.release();
    }
  }

  async deleteVendorPaymentMilestone(tenantId, projectId, milestoneId) {
    const query = `
      DELETE FROM vendor_payment_milestones
      WHERE id = $1 AND project_id = $2 AND tenant_id = $3
    `;
    const res = await pool.query(query, [milestoneId, projectId, tenantId]);
    return res.rowCount > 0;
  }
}

module.exports = new VendorPaymentService();
