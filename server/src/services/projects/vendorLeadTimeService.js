const pool = require('../../db/pool');

class VendorLeadTimeService {
  async listLeadTimes(tenantId) {
    const query = `
      SELECT lt.*, v.vendor_name
      FROM vendor_lead_times lt
      LEFT JOIN project_vendors v ON lt.vendor_id = v.id
      WHERE lt.tenant_id = $1
      ORDER BY lt.material_category ASC, v.vendor_name ASC
    `;
    const res = await pool.query(query, [tenantId]);
    return res.rows;
  }

  async saveLeadTime(tenantId, data) {
    const { vendorId, materialCategory, leadTimeDays } = data;
    const query = `
      INSERT INTO vendor_lead_times (tenant_id, vendor_id, material_category, lead_time_days)
      VALUES ($1, $2, $3, $4)
      ON CONFLICT (tenant_id, (COALESCE(vendor_id, '00000000-0000-0000-0000-000000000000'::uuid)), material_category)
      DO UPDATE SET lead_time_days = EXCLUDED.lead_time_days, updated_at = NOW()
      RETURNING *
    `;
    const res = await pool.query(query, [
      tenantId,
      vendorId || null,
      materialCategory,
      leadTimeDays || 0
    ]);
    return res.rows[0];
  }

  async deleteLeadTime(tenantId, id) {
    const query = `
      DELETE FROM vendor_lead_times
      WHERE id = $1 AND tenant_id = $2
    `;
    await pool.query(query, [id, tenantId]);
    return { success: true };
  }
}

module.exports = new VendorLeadTimeService();
