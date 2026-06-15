const leadRepository = require('../../repositories/leadRepository');
const { logAction } = require('../auditLog');

async function deleteLead({ tenantId, userId, leadId }) {
  // 1. Fetch lead — throw NOT_FOUND if missing.
  const currentLead = await leadRepository.findLeadById(tenantId, leadId);
  if (!currentLead) {
    throw new Error('NOT_FOUND');
  }

  // 2. leadRepository.softDeleteLead(tenantId, leadId).
  await leadRepository.softDeleteLead(tenantId, leadId);

  // 3. logAction({ ..., action:'lead.deleted', entity:'lead', entityId:leadId }).
  await logAction({
    tenantId,
    userId,
    action: 'lead.deleted',
    entity: 'lead',
    entityId: leadId
  });

  // 4. Return void.
}

module.exports = { deleteLead };
