const leadRepository = require('../../repositories/leadRepository');
const stageRepository = require('../../repositories/stageRepository');
const { updateLead } = require('./updateLead');
const { logAction } = require('../auditLog');
const { dispatchEvent } = require('../webhooks/webhookDispatcher');
const eventBus = require('../../utils/eventBus');
// const pool = require('../../config/db');

async function changeStage({ tenantId, userId, leadId, newStageId }) {
  // 1. Fetch current lead to get the old stage info
  const oldLead = await leadRepository.findLeadById(tenantId, leadId);
  if (!oldLead) {
    throw new Error('NOT_FOUND');
  }

  // 2. If it's already the same stage, just return the lead
  if (oldLead.stage_id === newStageId) {
    return oldLead;
  }

  // 3. Fetch new stage info to get the name for the audit log
  const newStage = await stageRepository.getStageById(tenantId, newStageId);
  if (!newStage) {
    throw new Error('INVALID_STAGE');
  }

  // 4. Call updateLead which handles the gate enforcement (mandatory_fields)
  await updateLead({
    tenantId,
    userId,
    leadId,
    data: { stageId: newStageId }
  });

  // 5. Log the specific funnel analytics action
  await logAction({
    tenantId,
    userId,
    action: 'lead.stage_changed',
    entity: 'lead',
    entityId: leadId,
    oldValue: {
      stageId: oldLead.stage_id,
      stageName: oldLead.stage_name || null
    },
    newValue: {
      stageId: newStage.id,
      stageName: newStage.name
    }
  });

  // 6. Return the updated lead with fully joined properties (stage_name, assignee_name)
  const updatedLeadFull = await leadRepository.findLeadById(tenantId, leadId);

  // Emit domain event for Decoupled architecture (AI, Notifications, Workflows will listen)
  eventBus.emit('lead.stage_changed', {
    tenantId,
    userId,
    lead: updatedLeadFull,
    oldStage: { id: oldLead.stage_id, name: oldLead.stage_name },
    newStage: { id: newStage.id, name: newStage.name }
  });

  // 7. Dispatch webhook
  dispatchEvent(tenantId, 'lead.stage_changed', updatedLeadFull);

  // 8. Refresh materialized view concurrently
  leadRepository.refreshPipelineSummary(tenantId).catch(console.error);

  return updatedLeadFull;
}

module.exports = { changeStage };
