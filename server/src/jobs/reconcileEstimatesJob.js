const pool = require('../db/pool');
const { fetchEstimateFromExternal } = require('../services/estimatorService');
const eventBus = require('../utils/eventBus');

// Run every hour
const INTERVAL_MS = 60 * 60 * 1000;

async function reconcilePendingEstimates() {
  try {
    // Find all estimates that are not finalized (e.g., draft or pending) and have an external reference
    const { rows } = await pool.query(
      `SELECT id, tenant_id, lead_id, estimator_reference_id 
       FROM lead_estimates 
       WHERE estimator_reference_id IS NOT NULL 
       AND status IN ('draft', 'pending', 'sent')`
    );

    if (rows.length === 0) return;

    for (const est of rows) {
      try {
        const externalData = await fetchEstimateFromExternal(est.estimator_reference_id);
        
        await pool.query(
          `UPDATE lead_estimates 
           SET status = $1, total_amount = $2, payload = $3, updated_at = NOW()
           WHERE id = $4`,
          [externalData.status, externalData.total_amount, externalData.payload, est.id]
        );

        eventBus.emit('lead.estimates_synced', {
          eventName: 'lead.estimates_synced',
          payload: { id: est.lead_id, source: 'background_job', referenceId: est.estimator_reference_id },
          context: { tenantId: est.tenant_id, userId: 'system' }
        });
      } catch (err) {
        console.error(`[ReconcileJob] Failed to reconcile estimate ${est.id}:`, err.message);
      }
    }
  } catch (err) {
    console.error('[ReconcileJob] Global error:', err);
  }
}

function start() {
  setInterval(reconcilePendingEstimates, INTERVAL_MS);
  console.log('[Jobs] ReconcileEstimatesJob started.');
}

module.exports = { start };
