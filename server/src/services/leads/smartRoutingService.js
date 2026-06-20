const pool = require('../../db/pool');

/**
 * Evaluates all active sales reps for a tenant and dynamically assigns the lead
 * to the rep with the lowest current workload (active leads).
 *
 * @param {string} tenantId 
 * @param {object} leadData 
 * @returns {Promise<string|null>} The assignee user ID, or null if no users found.
 */
async function assignLeadIntelligently(tenantId, leadData) {
  try {
    // 1. Try to find the best rep among sales and management roles
    const query = `
      SELECT u.id, COUNT(l.id) as active_leads
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN leads l ON u.id = l.assignee_id AND l.status NOT IN ('won', 'lost', 'archived', 'converted')
      WHERE u.tenant_id = $1 AND u.status = 'active' AND (r.name ILIKE '%sales%' OR r.name IN ('manager', 'admin', 'superadmin', 'gm'))
      GROUP BY u.id
      ORDER BY active_leads ASC
      LIMIT 1
    `;
    const res = await pool.query(query, [tenantId]);

    if (res.rows.length > 0) {
      console.log(`[SmartRouter] Assigned to ${res.rows[0].id} (Workload: ${res.rows[0].active_leads} leads)`);
      return res.rows[0].id;
    }

    // 2. Fallback: Any active user with lowest workload
    const fallbackQuery = `
      SELECT u.id, COUNT(l.id) as active_leads
      FROM users u
      LEFT JOIN leads l ON u.id = l.assignee_id AND l.status NOT IN ('won', 'lost', 'archived', 'converted')
      WHERE u.tenant_id = $1 AND u.status = 'active'
      GROUP BY u.id
      ORDER BY active_leads ASC
      LIMIT 1
    `;
    const fallbackRes = await pool.query(fallbackQuery, [tenantId]);

    if (fallbackRes.rows.length > 0) {
      console.log(`[SmartRouter] Fallback Assigned to ${fallbackRes.rows[0].id} (Workload: ${fallbackRes.rows[0].active_leads} leads)`);
      return fallbackRes.rows[0].id;
    }

    return null;
  } catch (error) {
    console.error('[SmartRouter] Routing error:', error);
    return null; // Gracefully fail and leave lead unassigned
  }
}

module.exports = {
  assignLeadIntelligently
};
