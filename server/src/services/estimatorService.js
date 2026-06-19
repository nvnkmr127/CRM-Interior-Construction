/**
 * Native Estimator Service
 */
const pool = require('../config/db');

async function createEstimate(tenantId, leadId, payload) {
  // calculate total amount from payload (rooms -> items -> qty * rate)
  let totalAmount = 0;
  if (payload && payload.rooms) {
    payload.rooms.forEach(room => {
      if (room.items) {
        room.items.forEach(item => {
          totalAmount += (Number(item.qty) || 0) * (Number(item.rate) || 0);
        });
      }
    });
  }

  // generate a fake reference ID
  const refId = `EST-${Math.floor(1000 + Math.random() * 9000)}`;

  const result = await pool.query(
    `INSERT INTO lead_estimates (tenant_id, lead_id, estimator_reference_id, status, total_amount, payload, created_at, updated_at)
     VALUES ($1, $2, $3, $4, $5, $6, NOW(), NOW())
     RETURNING *`,
    [tenantId, leadId, refId, 'draft', totalAmount, payload]
  );
  return result.rows[0];
}

async function getEstimates(tenantId, leadId) {
  const result = await pool.query(
    `SELECT * FROM lead_estimates WHERE tenant_id = $1 AND lead_id = $2 ORDER BY created_at DESC`,
    [tenantId, leadId]
  );
  return result.rows;
}

module.exports = {
  createEstimate,
  getEstimates
};
