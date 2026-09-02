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

       try {
         const { notifyUser } = require('../../integrations/notificationService');
         const pool = require('../../db/pool');
         let actorName = 'Admin / Manager';
         if (userId) {
           try {
             const uRes = await pool.query('SELECT name FROM users WHERE id = $1', [userId]);
             if (uRes.rows.length > 0 && uRes.rows[0].name) {
               actorName = uRes.rows[0].name;
             }
           } catch (e) {}
         }

         notifyUser(tenantId, data.assignee_id, {
           title: 'Lead Assigned',
           body: `Lead "${updatedLead.name}" has been assigned to you by ${actorName}.`,
           message: `Lead "${updatedLead.name}" has been assigned to you by ${actorName}.`,
           type: 'lead_assigned',
           lead_id: updatedLead.id,
           actor_id: userId || null,
           actor_name: actorName,
           reference_url: `/leads?id=${updatedLead.id}`
         }).catch(err => logger.error('[updateLead] Reassignment notification error:', err.message));
       } catch (notifErr) {
         logger.error('[updateLead] Failed to notify new assignee:', notifErr.message);
       }
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
