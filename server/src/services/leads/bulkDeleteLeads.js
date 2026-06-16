const pool = require('../../db/pool');

/**
 * Bulk deletes leads
 * @param {Array<string>} leadIds 
 * @param {string} tenantId 
 */
async function bulkDeleteLeads(leadIds, tenantId) {
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    throw new Error('No lead IDs provided');
  }

  // Use a transaction
  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Using ANY array constructor
    const query = `
      DELETE FROM leads 
      WHERE id = ANY($1::uuid[]) 
        AND tenant_id = $2
    `;
    const result = await client.query(query, [leadIds, tenantId]);
    
    await client.query('COMMIT');
    return result.rowCount;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { bulkDeleteLeads };
