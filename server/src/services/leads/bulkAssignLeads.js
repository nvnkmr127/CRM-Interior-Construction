const pool = require('../../db/pool');

/**
 * Bulk assigns leads to a specific user
 * @param {Array<string>} leadIds 
 * @param {string} assigneeId 
 * @param {string} tenantId 
 */
async function bulkAssignLeads(leadIds, assigneeId, tenantId) {
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    throw new Error('No lead IDs provided');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Verify assignee exists in tenant
    if (assigneeId) {
      const userRes = await client.query('SELECT id FROM users WHERE id = $1 AND tenant_id = $2 LIMIT 1', [assigneeId, tenantId]);
      if (userRes.rows.length === 0) {
        throw new Error('Invalid assignee');
      }
    }
    
    const query = `
      UPDATE leads 
      SET assignee_id = $1, updated_at = NOW()
      WHERE id = ANY($2::uuid[]) 
        AND tenant_id = $3
    `;
    const result = await client.query(query, [assigneeId, leadIds, tenantId]);
    
    await client.query('COMMIT');
    return result.rowCount;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { bulkAssignLeads };
