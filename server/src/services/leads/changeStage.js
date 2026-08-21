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

  // Prevent changing stage of already converted leads
  if (oldLead.status === 'converted') {
    const error = new Error('Lead is already converted and cannot be moved.');
    error.code = 'CONFLICT';
    throw error;
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
    data: { stage_id: newStageId }
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

  let mandatoryFields = newStage.mandatory_fields || [];
  if (typeof mandatoryFields === 'string') {
    try {
      mandatoryFields = JSON.parse(mandatoryFields);
    } catch (e) {
      mandatoryFields = [];
    }
  }
  let mandatoryFieldsText = "";
  if (Array.isArray(mandatoryFields) && mandatoryFields.length > 0) {
    const filledFields = [];
    const customFields = typeof updatedLeadFull.custom_fields === "string" ? JSON.parse(updatedLeadFull.custom_fields) : (updatedLeadFull.custom_fields || {});
    mandatoryFields.forEach(f => {
      let val;
      if (f.startsWith("custom_fields.")) {
        val = customFields[f.split(".")[1]];
      } else {
        val = updatedLeadFull[f];
      }
      filledFields.push(`${f}: ${val}`);
    });
    mandatoryFieldsText = " (Filled: " + filledFields.join(", ") + ")";
  }

  // Emit domain event for Decoupled architecture (AI, Notifications, Workflows will listen)
  eventBus.emit('lead.stage_changed', {
    tenantId,
    userId,
    lead: updatedLeadFull,
    oldStage: { id: oldLead.stage_id, name: oldLead.stage_name },
    newStage: { id: newStage.id, name: newStage.name },
    mandatoryFieldsText
  });

  // 7. Dispatch webhook
  dispatchEvent(tenantId, 'lead.stage_changed', updatedLeadFull);

  // 8. Refresh materialized view concurrently
  leadRepository.refreshPipelineSummary(tenantId).catch(console.error);

  return updatedLeadFull;
}

module.exports = { changeStage };
