const logger = require('../../utils/logger');
const leadRepository = require('../../repositories/leadRepository');
const { logAction } = require('../auditLog');
const { enqueueAutomation } = require('../../queues/automationQueue');
const eventBus = require('../../utils/eventBus');

async function updateLead({ tenantId, userId, leadId, data, txClient = null, skipSideEffects = false }) {
  logger.info('[updateLead] START', { tenantId, userId, leadId, keys: Object.keys(data) });

  const existingLead = await leadRepository.findLeadById(tenantId, leadId, txClient);
  if (!existingLead) {
    throw new Error('NOT_FOUND: Lead not found');
  }

  // Update repository
  const updatedLead = await leadRepository.updateLead(tenantId, leadId, data, txClient);

  if (!skipSideEffects) {
    try {
      await logAction({
        tenantId,
        userId,
        action: 'lead.updated',
        entity: 'lead',
        entityId: leadId,
        newValue: { updatedKeys: Object.keys(data) }
      });
    } catch (err) {
      logger.error('Failed to log action UPDATE_LEAD', err);
    }

    eventBus.emit('lead.updated', {
      eventName: 'lead.updated',
      payload: { previous: existingLead, current: updatedLead },
      context: { tenantId, userId }
    });
    
    if (data.assignee_id && data.assignee_id !== existingLead.assignee_id) {
       eventBus.emit('lead.assigned', {
         eventName: 'lead.assigned',
         payload: { lead: updatedLead, assigneeId: data.assignee_id, previousAssigneeId: existingLead.assignee_id },
         context: { tenantId, userId }
       });
    }

    try {
      await enqueueAutomation({
        tenantId,
        eventType: 'record.updated',
        entity: 'lead',
        record: updatedLead,
        changes: data
      });
    } catch (queueErr) {
      logger.error('Failed to enqueue automation UPDATE_LEAD', queueErr);
    }
  }

  return updatedLead;
}

module.exports = { updateLead };
