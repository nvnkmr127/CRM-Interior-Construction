const { Worker } = require('bullmq');
const { connection, useRedis } = require('../queueSetup');
const { findLeadById } = require('../../repositories/leadRepository');
const { listActivities } = require('../../services/activities/activityService');
const aiService = require('../../services/aiService');
const eventBus = require('../../services/eventBus');
const pool = require('../../db/pool');

let aiWorker = null;

if (useRedis) {
  aiWorker = new Worker('AI_Queue', async job => {
  const { tenantId, leadId } = job.data;
  
  if (job.name === 'analyzeLeadIntelligence') {
    console.log(`[aiWorker] Processing AI Intelligence for Lead: ${leadId}`);

    // 1. Fetch Lead & Context
    const lead = await findLeadById(tenantId, leadId);
    if (!lead) {
      console.warn(`[aiWorker] Lead ${leadId} not found`);
      return;
    }

    const { data: activities } = await listActivities({ tenantId, leadId, limit: 15 });

    // 2. Call AI Service to Generate Insights
    const intel = await aiService.analyzeLeadIntelligence(lead, activities, [], lead.custom_fields || {});

    // 3. Auto-Update Lead Fields (Next Action, Sentiment, Win Probability)
    const updateFields = [];
    const values = [];
    let queryIndex = 1;

    if (intel.nextAction) {
      updateFields.push(`next_action = $${queryIndex++}`);
      values.push(intel.nextAction);
    }
    if (intel.sentiment) {
      updateFields.push(`sentiment = $${queryIndex++}`);
      values.push(intel.sentiment);
    }
    if (intel.winProbability !== undefined) {
      updateFields.push(`win_probability = $${queryIndex++}`);
      values.push(intel.winProbability);
    }
    if (intel.suggestedFollowupDate) {
      updateFields.push(`suggested_followup_at = $${queryIndex++}`);
      values.push(intel.suggestedFollowupDate);
    }

    if (updateFields.length > 0) {
      values.push(tenantId, leadId);
      const updateQuery = `
        UPDATE leads 
        SET ${updateFields.join(', ')} 
        WHERE tenant_id = $${queryIndex - 2} AND id = $${queryIndex - 1}
      `;
      try {
        await pool.query(updateQuery, values);
        console.log(`[aiWorker] Auto-updated Lead ${leadId} with AI insights.`);
      } catch (err) {
        console.error(`[aiWorker] Failed to update lead AI fields:`, err);
      }
    }

    // 4. Publish AI Insight to the Event Bus
    const summaryStr = `Sentiment: ${intel.sentiment} | Win Prob: ${intel.winProbability}%\nNext Best Action: ${intel.nextAction}`;
    eventBus.publish('ai.insight_generated', {
      lead_id: leadId,
      id: job.id, // pseudo ID
      summary: summaryStr
    }, { tenantId, userId: 'system_ai' });

    console.log(`[aiWorker] Finished AI Intelligence for Lead: ${leadId}`);
  }
  }, { connection });

  aiWorker.on('completed', job => {
    console.log(`AI Job ${job.id} has completed!`);
  });

  aiWorker.on('failed', (job, err) => {
    console.error(`AI Job ${job.id} has failed with ${err.message}`);
  });
} else {
  aiWorker = {
    on: () => {},
    close: async () => {}
  };
}

module.exports = aiWorker;
