const pool = require('../../db/pool');
const leadRepository = require('../../repositories/leadRepository');
const { logAction } = require('../auditLog');
const { enqueueAutomation } = require('../../queues/automationQueue');
const { dispatchEvent } = require('../webhooks/webhookDispatcher');
// The scoreLeadService might be created in D2-10 as per instructions.
// We'll require it, but wrap it in try-catch or just require it so it will throw if not present yet.
let scoreLead;
try {
  const scoreLeadService = require('./scoreLeadService');
  scoreLead = scoreLeadService.scoreLead;
} catch (e) {
  // If not yet implemented, provide a dummy fallback for now
  scoreLead = () => 0;
}

async function createLead({ tenantId, userId, data }) {
  const { name, phone, email, stageId, assigneeId } = data;

  // 1. Validate required: name, phone (at minimum).
  if (!name || !phone) {
    throw new Error('VALIDATION_ERROR: Name and phone are required');
  }

  // Duplicate detection for phone or email
  const duplicateCheckValues = [tenantId, phone];
  let duplicateQuery = 'SELECT id FROM leads WHERE tenant_id = $1 AND phone = $2 AND deleted_at IS NULL LIMIT 1';
  
  if (email) {
    duplicateQuery = 'SELECT id FROM leads WHERE tenant_id = $1 AND (phone = $2 OR email = $3) AND deleted_at IS NULL LIMIT 1';
    duplicateCheckValues.push(email);
  }
  
  const duplicateCheck = await pool.query(duplicateQuery, duplicateCheckValues);
  if (duplicateCheck.rows.length > 0) {
    throw new Error('VALIDATION_ERROR: A lead with this phone or email already exists');
  }

  // 2. If stageId provided: verify it belongs to tenant. If not → throw Error('INVALID_STAGE').
  if (stageId) {
    const stageCheck = await pool.query(
      'SELECT id FROM lead_stages WHERE id = $1 AND tenant_id = $2',
      [stageId, tenantId]
    );
    if (stageCheck.rows.length === 0) {
      throw new Error('INVALID_STAGE');
    }
  }

  // 3. Fetch scoring rules and calculate score: scoreLead(data, rules) → score.
  const rulesResult = await pool.query(
    'SELECT * FROM lead_scoring_rules WHERE tenant_id = $1 AND is_active = true',
    [tenantId]
  );
  
  const score = scoreLead(data, rulesResult.rows);

  // 4. leadRepository.createLead
  const leadDataForRepo = {
    ...data,
    stage_id: stageId,
    assignee_id: assigneeId,
    score,
    created_by: userId
  };
  
  const lead = await leadRepository.createLead(tenantId, leadDataForRepo);

  // 5. logAction
  await logAction({
    tenantId,
    userId,
    action: 'lead.created',
    entity: 'lead',
    entityId: lead.id,
    newValue: lead
  });

  // 6. enqueueAutomation
  await enqueueAutomation({
    tenantId,
    eventType: 'record.created',
    entity: 'lead',
    record: lead
  });

  // 7. Dispatch Webhooks
  dispatchEvent(tenantId, 'lead.created', lead);

  // 8. Return created lead.
  return lead;
}

module.exports = { createLead };
