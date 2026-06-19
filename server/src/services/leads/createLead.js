const pool = require('../../db/pool');
const leadRepository = require('../../repositories/leadRepository');
const { logAction } = require('../auditLog');
const { enqueueAutomation } = require('../../queues/automationQueue');
const { dispatchEvent } = require('../webhooks/webhookDispatcher');
// The scoreLeadService might be created in D2-10 as per instructions.
// We'll require it, but wrap it in try-catch or just require it so it will throw if not present yet.
let scoreLead;
let calculateAIScore;
try {
  const scoreLeadService = require('./scoreLeadService');
  scoreLead = scoreLeadService.scoreLead;
  calculateAIScore = scoreLeadService.calculateAIScore;
} catch (e) {
  // If not yet implemented, provide a dummy fallback for now
  scoreLead = () => 0;
  calculateAIScore = null;
}

async function createLead({ tenantId, userId, data }) {
  const { name, phone, email, stageId, assigneeId } = data;
  console.log('[createLead] START', { tenantId, userId, name, phone, email, stageId, assigneeId });

  // 1. Validate required: name, phone (at minimum).
  if (!name || !phone) {
    console.error('[createLead] FAIL validation: name or phone missing', { name, phone });
    throw new Error('VALIDATION_ERROR: Name and phone are required');
  }

  // Duplicate detection for phone or email
  const duplicateCheckValues = [tenantId, phone];
  let duplicateQuery = 'SELECT id FROM leads WHERE tenant_id = $1 AND phone = $2 AND deleted_at IS NULL LIMIT 1';

  if (email) {
    duplicateQuery = 'SELECT id FROM leads WHERE tenant_id = $1 AND (phone = $2 OR email = $3) AND deleted_at IS NULL LIMIT 1';
    duplicateCheckValues.push(email);
  }

  console.log('[createLead] Checking duplicates...', { phone, email });
  const duplicateCheck = await pool.query(duplicateQuery, duplicateCheckValues);
  if (duplicateCheck.rows.length > 0) {
    console.error('[createLead] FAIL duplicate: lead already exists with phone/email', { phone, email, existingId: duplicateCheck.rows[0].id });
    throw new Error('VALIDATION_ERROR: A lead with this phone or email already exists');
  }
  console.log('[createLead] No duplicate found.');

  // 2. If stageId provided: verify it belongs to tenant.
  if (stageId) {
    console.log('[createLead] Verifying stageId...', { stageId, tenantId });
    const stageCheck = await pool.query(
      'SELECT id FROM lead_stages WHERE id = $1 AND tenant_id = $2',
      [stageId, tenantId]
    );
    if (stageCheck.rows.length === 0) {
      console.error('[createLead] FAIL stage: stageId not found for tenant', { stageId, tenantId });
      throw new Error('INVALID_STAGE');
    }
    console.log('[createLead] Stage verified OK.');
  }

  // 3. Fetch scoring rules and calculate score.
  console.log('[createLead] Fetching scoring rules...');
  const rulesResult = await pool.query(
    'SELECT * FROM lead_scoring_rules WHERE tenant_id = $1 AND is_active = true',
    [tenantId]
  );
  console.log('[createLead] Scoring rules fetched:', rulesResult.rows.length);

  const score = scoreLead(data, rulesResult.rows);
  console.log('[createLead] Score calculated:', score);

  let win_probability = 0;
  let ai_score_breakdown = {};
  if (calculateAIScore) {
    const aiScores = calculateAIScore(data);
    win_probability = aiScores.win_probability;
    ai_score_breakdown = aiScores.ai_score_breakdown;
  }

  // 4. leadRepository.createLead
  const leadDataForRepo = {
    ...data,
    stage_id: stageId,
    assignee_id: assigneeId,
    score,
    win_probability,
    ai_score_breakdown,
    created_by: userId
  };
  console.log('[createLead] Inserting lead into DB...', leadDataForRepo);

  let lead;
  try {
    lead = await leadRepository.createLead(tenantId, leadDataForRepo);
    console.log('[createLead] Lead inserted OK, id:', lead?.id);
  } catch (dbErr) {
    console.error('[createLead] FAIL DB insert:', dbErr.message, { code: dbErr.code, detail: dbErr.detail, constraint: dbErr.constraint });
    throw dbErr;
  }

  // 5. logAction
  console.log('[createLead] Logging audit action...');
  try {
    await logAction({
      tenantId,
      userId,
      action: 'lead.created',
      entity: 'lead',
      entityId: lead.id,
      newValue: lead
    });
  } catch (auditErr) {
    console.error('[createLead] WARN audit log failed (non-fatal):', auditErr.message);
  }

  // 6. enqueueAutomation
  console.log('[createLead] Enqueuing automation...');
  try {
    await enqueueAutomation({
      tenantId,
      eventType: 'record.created',
      entity: 'lead',
      record: lead
    });
  } catch (queueErr) {
    console.error('[createLead] WARN automation enqueue failed (non-fatal):', queueErr.message);
  }

  // 7. Dispatch Webhooks
  dispatchEvent(tenantId, 'lead.created', lead);

  console.log('[createLead] DONE, returning lead id:', lead.id);
  return lead;
}

module.exports = { createLead };
