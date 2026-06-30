const pool = require('../config/db');

class MaterialUsageRepository {
  async logUsage(tenantId, projectId, userId, data) {
    const {
      po_item_id,
      boq_item_id,
      activity_name,
      material_name,
      quantity_used,
      unit,
      date_used,
      notes
    } = data;

    const query = `
      INSERT INTO site_material_usages (
        tenant_id, project_id, po_item_id, boq_item_id, activity_name, material_name, quantity_used, unit, date_used, notes, recorded_by
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
      RETURNING *
    `;

    const values = [
      tenantId,
      projectId,
      po_item_id || null,
      boq_item_id || null,
      activity_name,
      material_name,
      quantity_used,
      unit,
      date_used,
      notes,
      userId
    ];

    const { rows } = await pool.query(query, values);
    return rows[0];
  }

  async findUsagesByProject(tenantId, projectId) {
    const query = `
      SELECT u.*, rb.name as recorded_by_name, poi.item_name as po_item_name
      FROM site_material_usages u
      LEFT JOIN users rb ON u.recorded_by = rb.id
      LEFT JOIN purchase_order_items poi ON u.po_item_id = poi.id
      WHERE u.tenant_id = $1 AND u.project_id = $2
      ORDER BY u.date_used DESC, u.created_at DESC
    `;
    const { rows } = await pool.query(query, [tenantId, projectId]);
    return rows;
  }

  async getRemainingSiteStock(tenantId, projectId) {
    // Calculates stock from PO items that belong to the project.
    // Stock = quantity_received (from deliveries/inspections) - sum(quantity_used)
    const query = `
      WITH usages AS (
        SELECT po_item_id, SUM(quantity_used) as total_used
        FROM site_material_usages
        WHERE tenant_id = $1 AND project_id = $2 AND po_item_id IS NOT NULL
        GROUP BY po_item_id
      )
      SELECT 
        poi.id as po_item_id,
        poi.item_name,
        poi.unit,
        poi.quantity as procured_quantity,
        poi.quantity_received,
        COALESCE(u.total_used, 0) as quantity_used,
        (poi.quantity_received - COALESCE(u.total_used, 0)) as remaining_stock
      FROM purchase_order_items poi
      JOIN purchase_orders po ON poi.purchase_order_id = po.id
      LEFT JOIN usages u ON poi.id = u.po_item_id
      WHERE po.tenant_id = $1 AND po.project_id = $2
      ORDER BY poi.item_name ASC
    `;
    const { rows } = await pool.query(query, [tenantId, projectId]);
    return rows;
  }
}

module.exports = new MaterialUsageRepository();
