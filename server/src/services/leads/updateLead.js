const leadRepository = require('../../repositories/leadRepository');
const stageRepository = require('../../repositories/stageRepository');
const { logAction } = require('../auditLog');
const { enqueueAutomation } = require('../../queues/automationQueue');
const { dispatchEvent } = require('../webhooks/webhookDispatcher');

async function updateLead({ tenantId, userId, leadId, data }) {
  // 1. Fetch current lead
  const currentLead = await leadRepository.findLeadById(tenantId, leadId);
  if (!currentLead) {
    throw new Error('NOT_FOUND');
  }

  // Handle naming conventions (stageId vs stage_id)
  const newStageId = data.stageId || data.stage_id;
  const currentStageId = currentLead.stage_id;

  // 2. If data.stageId is present AND different from current
  if (newStageId && newStageId !== currentStageId) {
    // a. Fetch new stage config
    const newStage = await stageRepository.getStageById(tenantId, newStageId);
    if (!newStage) {
      throw new Error('INVALID_STAGE');
    }

    // b. Check that lead has non-empty values for all mandatory_fields
    const mandatoryFields = newStage.mandatory_fields || [];
    const missing = [];

    // Combine current lead data with incoming updates to check fields
    const leadState = { ...currentLead, ...data };
    
    // Parse custom_fields if it's a string, otherwise use it directly
    const customFields = typeof leadState.custom_fields === 'string' 
      ? JSON.parse(leadState.custom_fields) 
      : (leadState.custom_fields || {});

    for (const field of mandatoryFields) {
      let value;
      if (field.startsWith('custom_fields.')) {
        const customKey = field.split('.')[1];
        value = customFields[customKey];
      } else {
        value = leadState[field];
      }

      if (value === null || value === undefined || value === '') {
        missing.push(field);
      }
    }

    // c. If any missing -> throw Error with details
    if (missing.length > 0) {
      const err = new Error('STAGE_GATE_FAILED');
      err.code = 'STAGE_GATE_FAILED';
      err.missing = missing;
      throw err;
    }
  }

  // Map camelCase to snake_case for the repository if needed
  const updateData = { ...data };
  if (updateData.stageId) {
    updateData.stage_id = updateData.stageId;
    delete updateData.stageId;
  }
  if (updateData.assigneeId) {
    updateData.assignee_id = updateData.assigneeId;
    delete updateData.assigneeId;
  }

  // 3. Update lead
  const updatedLead = await leadRepository.updateLead(tenantId, leadId, updateData);

  // 4. logAction
  await logAction({
    tenantId,
    userId,
    action: 'lead.updated',
    entity: 'lead',
    entityId: leadId,
    oldValue: currentLead,
    newValue: updatedLead
  });

  // 5. If stage changed -> enqueueAutomation
  if (newStageId && newStageId !== currentStageId) {
    await enqueueAutomation({
      tenantId,
      eventType: 'field.changed',
      entity: 'lead',
      record: updatedLead,
      changes: {
        stage_id: {
          old: currentStageId,
          new: newStageId
        }
      }
    });
  }

  // 6. Dispatch Webhook
  dispatchEvent(tenantId, 'lead.updated', updatedLead);

  // 7. Return updatedLead
  return updatedLead;
}

module.exports = { updateLead };
