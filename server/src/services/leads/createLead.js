const pool = require('../../db/pool');
const leadRepository = require('../../repositories/leadRepository');
const { logAction } = require('../auditLog');
const { enqueueAutomation } = require('../../queues/automationQueue');
const { dispatchEvent } = require('../webhooks/webhookDispatcher');
const { scoreLead, calculateAIScore } = require('./scoreLeadService');

async function createLead({ tenantId, userId, data }) {
  const { name, phone, email, stageId, assigneeId } = data;
  console.log('[createLead] START', { tenantId, userId, name, phone, email, stageId, assigneeId });

  // 1. Validate required: name, phone (at minimum).
  if (!name || !phone) {
    console.error('[createLead] FAIL validation: name or phone missing', { name, phone });
    throw new Error('VALIDATION_ERROR: Name and phone are required');
  }

  if (data.source) {
    const tenantRes = await pool.query('SELECT config FROM tenants WHERE id = $1', [tenantId]);
    const config = typeof tenantRes.rows[0].config === 'string' ? JSON.parse(tenantRes.rows[0].config || '{}') : (tenantRes.rows[0].config || {});
    const validSources = config.lead_sources || ['Facebook', 'IndiaMART', 'Referral', 'Website', 'Direct', 'Other'];
    if (!validSources.includes(data.source)) {
      console.error('[createLead] FAIL validation: invalid source', { source: data.source });
      throw new Error('VALIDATION_ERROR: Invalid lead source');
    }
  }

  const digitsOnly = phone.replace(/\D/g, '');
  if (digitsOnly.length < 10) {
    console.error('[createLead] FAIL validation: phone is too short', { phone });
    throw new Error('VALIDATION_ERROR: Phone number must contain at least 10 digits');
  }

  if (email) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(email)) {
      console.error('[createLead] FAIL validation: invalid email format', { email });
      throw new Error('VALIDATION_ERROR: Invalid email format');
    }
  }

  // Duplicate detection for phone or email or name+address
  const addressVal = data.address || data.locality || (data.custom_fields && data.custom_fields.address);
  
  const duplicateCheckValues = [tenantId, phone];
  let duplicateQuery = 'SELECT id FROM leads WHERE tenant_id = $1 AND deleted_at IS NULL AND (phone = $2';

  if (email) {
    duplicateCheckValues.push(email);
    duplicateQuery += ` OR email = $${duplicateCheckValues.length}`;
  }

  if (name && addressVal) {
    duplicateCheckValues.push(name, addressVal);
    duplicateQuery += ` OR (name = $${duplicateCheckValues.length - 1} AND (locality = $${duplicateCheckValues.length} OR custom_fields->>'address' = $${duplicateCheckValues.length}))`;
  }

  duplicateQuery += ') LIMIT 1';

  console.log('[createLead] Checking duplicates...', { phone, email, name, addressVal });
  const duplicateCheck = await pool.query(duplicateQuery, duplicateCheckValues);
  if (duplicateCheck.rows.length > 0) {
    console.error('[createLead] FAIL duplicate: lead already exists with phone/email or name+address', { phone, email, name, addressVal, existingId: duplicateCheck.rows[0].id });
    throw new Error('VALIDATION_ERROR: A lead with this phone, email, or identical name and address already exists');
  }
  console.log('[createLead] No duplicate found.');

  // 2. If stageId provided: verify it belongs to tenant. If not provided: fallback to default.
  let finalStageId = stageId;
  if (finalStageId) {
    console.log('[createLead] Verifying stageId...', { finalStageId, tenantId });
    const stageCheck = await pool.query(
      'SELECT id FROM lead_stages WHERE id = $1 AND tenant_id = $2',
      [finalStageId, tenantId]
    );
    if (stageCheck.rows.length === 0) {
      console.error('[createLead] FAIL stage: stageId not found for tenant', { finalStageId, tenantId });
      throw new Error('INVALID_STAGE');
    }
    console.log('[createLead] Stage verified OK.');
  } else {
    console.log('[createLead] No stageId provided, fetching default first stage...');
    // Assuming lead_stages has a 'sequence' or similar ordering column, fallback to ordering by created_at or id.
    // Try sequence first, then fallback.
    try {
      const defaultStageCheck = await pool.query(
        'SELECT id FROM lead_stages WHERE tenant_id = $1 ORDER BY sequence ASC, created_at ASC LIMIT 1',
        [tenantId]
      );
      if (defaultStageCheck.rows.length > 0) {
        finalStageId = defaultStageCheck.rows[0].id;
        console.log('[createLead] Default stage assigned:', finalStageId);
      }
    } catch (e) {
      // If 'sequence' doesn't exist, fallback to created_at
      const defaultStageCheckFallback = await pool.query(
        'SELECT id FROM lead_stages WHERE tenant_id = $1 ORDER BY created_at ASC LIMIT 1',
        [tenantId]
      );
      if (defaultStageCheckFallback.rows.length > 0) {
        finalStageId = defaultStageCheckFallback.rows[0].id;
        console.log('[createLead] Default stage assigned (fallback):', finalStageId);
      }
    }
  }

  // 3. Fetch scoring rules and calculate score.
  console.log('[createLead] Fetching scoring rules...');
  const rulesResult = await pool.query(
    'SELECT * FROM lead_scoring_rules WHERE tenant_id = $1 AND is_active = true',
    [tenantId]
  );
  console.log('[createLead] Scoring rules fetched:', rulesResult.rows.length);

  const scoreResultObj = scoreLead(data, rulesResult.rows);
  const score = scoreResultObj.score;
  const score_breakdown = scoreResultObj.breakdown;
  console.log('[createLead] Score calculated:', score);

  let win_probability = 0;
  let ai_score_breakdown = {};
  if (calculateAIScore) {
    const aiScores = calculateAIScore(data);
    win_probability = aiScores.win_probability;
    ai_score_breakdown = aiScores.ai_score_breakdown;
  }

  let finalAssigneeId = assigneeId;
  if (!finalAssigneeId) {
    console.log('[createLead] No assigneeId provided, invoking Smart Router...');
    const { assignLeadIntelligently } = require('./smartRoutingService');
    finalAssigneeId = await assignLeadIntelligently(tenantId, data);
    
    if (!finalAssigneeId) {
      console.log('[createLead] Smart Router returned null. Dispatching notification...');
      try {
        const { notifyUser } = require('../../integrations/notificationService');
        if (userId) {
          notifyUser(tenantId, userId, {
            title: 'Unassigned Lead',
            body: `Smart Router could not find an available assignee for the new lead: ${name}. Please assign manually.`,
            type: 'alert'
          }).catch(e => console.error('Notify error', e));
        }
      } catch (err) {
        console.error('[createLead] Failed to dispatch notification for unassigned lead', err);
      }
    }
  }

  // 4. leadRepository.createLead
  const currentCustomFields = data.custom_fields || {};
  const updatedCustomFields = { ...currentCustomFields, score_breakdown };
  
  const leadDataForRepo = {
    ...data,
    custom_fields: updatedCustomFields,
    stage_id: finalStageId,
    assignee_id: finalAssigneeId,
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
