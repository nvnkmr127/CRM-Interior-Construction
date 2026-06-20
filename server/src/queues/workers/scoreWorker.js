const { Worker } = require('bullmq');
const { connection } = require('../queueSetup');
const pool = require('../../db/pool');
const { calculateAIScore } = require('../../services/leads/scoreLeadService');
const leadRepository = require('../../repositories/leadRepository');

const scoreWorker = new Worker('Score_Queue', async job => {
  if (job.name === 'decay_scores') {
    console.log('[Score Worker] Running time-based score recalculation...');
    try {
      // Fetch active leads across all tenants
      // For a real production system, this should be batched/paginated
      const client = await pool.connect();
      try {
        const result = await client.query(`
          SELECT l.*,
                 lp.builder AS builder_name, lp.possession_date, lp.house_status, lp.property_type, lp.carpet_area AS carpet_area_sqft,
                 lpref.interior_style, lpref.material AS material_preference,
                 COALESCE(EXTRACT(DAY FROM CURRENT_TIMESTAMP - l.updated_at), 0) AS days_in_stage
          FROM leads l
          LEFT JOIN lead_properties lp ON l.id = lp.lead_id
          LEFT JOIN lead_preferences lpref ON l.id = lpref.lead_id
          WHERE l.status = 'active' AND l.deleted_at IS NULL
        `);

        for (const lead of result.rows) {
          const aiScoreObj = calculateAIScore(lead);
          
          // Check if it's different from what's stored
          const currentCustomFields = typeof lead.custom_fields === 'string' ? JSON.parse(lead.custom_fields || '{}') : (lead.custom_fields || {});
          const currentWinProb = currentCustomFields.win_probability;
          const currentBreakdown = currentCustomFields.ai_score_breakdown || {};

          let changed = false;
          if (aiScoreObj.win_probability !== currentWinProb) changed = true;
          else {
            for (const key of Object.keys(aiScoreObj.ai_score_breakdown)) {
              if (aiScoreObj.ai_score_breakdown[key] !== currentBreakdown[key]) {
                changed = true;
                break;
              }
            }
          }

          if (changed) {
            await leadRepository.updateLead(lead.tenant_id, lead.id, {
              win_probability: aiScoreObj.win_probability,
              ai_score_breakdown: aiScoreObj.ai_score_breakdown
            });
          }
        }
        console.log(`[Score Worker] Finished. Processed ${result.rows.length} leads.`);
      } finally {
        client.release();
      }
    } catch (err) {
      console.error('[Score Worker] Error recalculating scores:', err);
      throw err;
    }
  }
}, { connection });

scoreWorker.on('failed', (job, err) => {
  console.error(`[Score Worker] Job ${job.id} failed:`, err);
});

module.exports = scoreWorker;
