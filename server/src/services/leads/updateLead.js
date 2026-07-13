const leadRepository = require('../../repositories/leadRepository');
const stageRepository = require('../../repositories/stageRepository');
const { logAction } = require('../auditLog');
const { enqueueAutomation } = require('../../queues/automationQueue');
const { dispatchEvent } = require('../webhooks/webhookDispatcher');
const pool = require('../../db/pool');

async function updateLead({ tenantId, userId, leadId, data }) {
  // 1. Validate email format if provided
  if (data.email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(data.email)) {
      console.error('[updateLead] FAIL validation: invalid email format', { email: data.email });
      throw new Error('VALIDATION_ERROR: Invalid email format');
    }
  }

  if (data.source) {
    const tenantRes = await pool.query('SELECT config FROM tenants WHERE id = $1', [tenantId]);
    const config = typeof tenantRes.rows[0].config === 'string' ? JSON.parse(tenantRes.rows[0].config || '{}') : (tenantRes.rows[0].config || {});
    const validSources = config.lead_sources || ['Facebook', 'IndiaMART', 'Referral', 'Website', 'Direct', 'Other'];
    if (!validSources.includes(data.source)) {
      console.error('[updateLead] FAIL validation: invalid source', { source: data.source });
      throw new Error('VALIDATION_ERROR: Invalid lead source');
    }
  }

  if (data.phone) {
    const digitsOnly = data.phone.replace(/\D/g, '');
    if (digitsOnly.length < 10) {
      console.error('[updateLead] FAIL validation: phone is too short', { phone: data.phone });
      throw new Error('VALIDATION_ERROR: Phone number must contain at least 10 digits');
    }
  }

  // 2. Fetch current lead
  const currentLead = await leadRepository.findLeadById(tenantId, leadId);
  if (!currentLead) {
    throw new Error('NOT_FOUND');
  }

  // OPTIMISTIC LOCK CHECK
  if (data.updated_at) {
    const currentUpdatedAt = new Date(currentLead.updated_at).getTime();
    const providedUpdatedAt = new Date(data.updated_at).getTime();
    
    // Check if the current timestamp is significantly newer than the client's provided timestamp
    if (Math.abs(currentUpdatedAt - providedUpdatedAt) > 1000) {
      console.error('[updateLead] FAIL optimistic lock:', { currentUpdatedAt, providedUpdatedAt });
      throw new Error('OPTIMISTIC_LOCK_FAILED');
    }
  }

  // Handle naming conventions (stageId vs stage_id)
  const newStageId = data.stageId || data.stage_id;
  const currentStageId = currentLead.stage_id;

  // Combine current lead data with incoming updates to check fields
  const leadState = { ...currentLead, ...data };

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

  // 3. Calculate new AI score based on merged leadState
  const { calculateAIScore } = require('./scoreLeadService');
  const aiScoreObj = calculateAIScore(leadState);
  
  updateData.win_probability = aiScoreObj.win_probability;
  updateData.ai_score_breakdown = aiScoreObj.ai_score_breakdown;

  // 4. Update lead
  const updatedLead = await leadRepository.updateLead(tenantId, leadId, updateData);

  // 5. Recalculate rules-based score
  const { getAndScoreLead } = require('./scoreLeadService');
  const scoreResultObj = await getAndScoreLead(tenantId, updatedLead);
  const newScore = scoreResultObj.score;
  const newBreakdown = scoreResultObj.breakdown;
  
  let finalLead = updatedLead;
  // If score changed OR breakdown changed, we can update custom_fields.score_breakdown
  const currentCustomFields = typeof updatedLead.custom_fields === 'string' ? JSON.parse(updatedLead.custom_fields || '{}') : (updatedLead.custom_fields || {});
  
  // We'll update if score changed OR if we just want to ensure breakdown is saved
  const needsUpdate = newScore !== updatedLead.score || JSON.stringify(currentCustomFields.score_breakdown) !== JSON.stringify(newBreakdown);
  
  if (needsUpdate) {
    const updatedCustomFields = { ...currentCustomFields, score_breakdown: newBreakdown };
    finalLead = await leadRepository.updateLead(tenantId, leadId, { 
      score: newScore,
      custom_fields: updatedCustomFields
    });
  }

  // 4. logAction
  await logAction({
    tenantId,
    userId,
    action: 'lead.updated',
    entity: 'lead',
    entityId: leadId,
    oldValue: currentLead,
    newValue: finalLead
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

  // 6. If assignee changed -> Notify new assignee
  const newAssigneeId = updateData.assignee_id;
  const currentAssigneeId = currentLead.assignee_id;
  if (newAssigneeId && newAssigneeId !== currentAssigneeId) {
    const { notifyUser } = require('../notificationService');
    notifyUser({
      tenantId,
      userId: newAssigneeId,
      type: 'LEAD_ASSIGNED',
      message: `You have been assigned a new lead: ${finalLead.name || 'Unknown'}`,
      referenceUrl: `/leads/${leadId}`,
      actorId: userId
    });
  }

  // 6. Dispatch Webhook
  dispatchEvent(tenantId, 'lead.updated', finalLead);

  // 7. Return finalLead
  return finalLead;
}

module.exports = { updateLead };
