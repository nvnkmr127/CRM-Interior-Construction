const pool = require('../db/pool');

async function getStageById(tenantId, stageId) {
  const query = `
    SELECT * FROM lead_stages
    WHERE tenant_id = $1 AND id = $2
  `;
  const result = await pool.query(query, [tenantId, stageId]);
  return result.rows[0] || null;
}

module.exports = {
  getStageById
};
