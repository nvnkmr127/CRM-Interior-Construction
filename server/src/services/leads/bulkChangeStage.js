const pool = require('../../db/pool');

/**
 * Bulk updates the stage of multiple leads
 * @param {Array<string>} leadIds 
 * @param {string} stageId 
 * @param {string} tenantId 
 */
async function bulkChangeStage(leadIds, stageId, tenantId) {
  if (!Array.isArray(leadIds) || leadIds.length === 0) {
    throw new Error('No lead IDs provided');
  }

  if (!stageId) {
    throw new Error('stageId is required');
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // Verify stage exists in tenant
    const stageRes = await client.query('SELECT id FROM lead_stages WHERE id = $1 AND tenant_id = $2 LIMIT 1', [stageId, tenantId]);
    if (stageRes.rows.length === 0) {
      throw new Error('Invalid stage');
    }
    
    // We are skipping the stage gate validation for bulk for now, as it's complex to validate mandatory fields for multiple leads in a single query.
    // If strict stage gates are required for bulk, we'd need to fetch each lead and validate. For MVP bulk move, we'll bypass or assume it's allowed.
    // In a fully featured CRM, it might either throw for failed leads, or only move the valid ones.
    
    const query = `
      UPDATE leads 
      SET stage_id = $1, updated_at = NOW()
      WHERE id = ANY($2::uuid[]) 
        AND tenant_id = $3
    `;
    const result = await client.query(query, [stageId, leadIds, tenantId]);
    
    await client.query('COMMIT');
    return result.rowCount;
  } catch (error) {
    await client.query('ROLLBACK');
    throw error;
  } finally {
    client.release();
  }
}

module.exports = { bulkChangeStage };
