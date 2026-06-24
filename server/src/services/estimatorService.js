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

// Simulate fetching from external system
async function fetchEstimateFromExternal(referenceId) {
  // In a real scenario, this would be an Axios call to the external estimator API
  // e.g. return axios.get(`https://api.estimator.com/v1/estimates/${referenceId}`);
  
  // For simulation, we randomly update the status if it's draft, or just return existing
  const mockStatuses = ['draft', 'sent', 'accepted', 'rejected'];
  return {
    estimator_reference_id: referenceId,
    status: mockStatuses[Math.floor(Math.random() * mockStatuses.length)],
    total_amount: Math.floor(1000 + Math.random() * 50000), // Updated amount
    payload: { synced_at: new Date().toISOString() }
  };
}

async function reconcileEstimates(tenantId, leadId) {
  const estimates = await getEstimates(tenantId, leadId);
  const updatedEstimates = [];

  for (const est of estimates) {
    if (est.estimator_reference_id) {
      try {
        const externalData = await fetchEstimateFromExternal(est.estimator_reference_id);
        
        const result = await pool.query(
          `UPDATE lead_estimates 
           SET status = $1, total_amount = $2, payload = $3, updated_at = NOW()
           WHERE id = $4 AND tenant_id = $5
           RETURNING *`,
          [externalData.status, externalData.total_amount, externalData.payload, est.id, tenantId]
        );
        updatedEstimates.push(result.rows[0]);
      } catch (err) {
        console.error(`Failed to reconcile estimate ${est.id}:`, err);
        throw new Error(`External estimator API unreachable for reference ${est.estimator_reference_id}`);
      }
    } else {
      updatedEstimates.push(est);
    }
  }
  return updatedEstimates;
}

module.exports = {
  createEstimate,
  getEstimates,
  reconcileEstimates
};
