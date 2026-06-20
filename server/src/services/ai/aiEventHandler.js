const eventBus = require('../eventBus');
const { aiQueue } = require('../../queues/queueSetup');

// Subscribe to Lead events
eventBus.on('lead.stage_changed', async (event) => {
  const { payload, context } = event;
  const leadId = payload.id || (payload.lead && payload.lead.id);
  const tenantId = context.tenantId;

  if (leadId && tenantId) {
    await aiQueue.add('analyzeLeadIntelligence', {
      tenantId,
      leadId
    });
  }
});

// Subscribe to task completions and activities
eventBus.on('task.completed', async (event) => {
  const { payload, context } = event;
  const leadId = payload.lead_id || payload.record?.lead_id;
  const tenantId = context.tenantId;

  if (leadId && tenantId) {
    await aiQueue.add('analyzeLeadIntelligence', {
      tenantId,
      leadId
    });
  }
});

console.log('[AIService] Subscribed to EventBus events');
