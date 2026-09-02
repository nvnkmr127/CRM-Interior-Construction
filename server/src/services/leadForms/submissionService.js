const pool = require('../../db/pool');
const leadRepository = require('../../repositories/leadRepository');
const leadFormRepository = require('../../repositories/leadFormRepository');
const logger = require('../../utils/logger');

async function processSubmission({ slug, data, files = [], ipAddress, userAgent }) {
  // 1. Find form by slug
  const formRes = await pool.query(
    'SELECT * FROM lead_forms WHERE slug = $1 AND status = $2 LIMIT 1',
    [slug, 'active']
  );
  if (formRes.rows.length === 0) {
    const error = new Error('Form not found or inactive');
    error.status = 404;
    throw error;
  }

  const form = formRes.rows[0];
  const tenantId = form.tenant_id;

  // 2. Extract standard fields and custom fields
  const name = data.name || data.fullName || data.full_name || 'Web Form Lead';
  const email = data.email || null;
  const phone = data.phone || data.mobile || null;
  const notes = data.notes || data.message || data.comments || null;
  const source = form.lead_source || 'Website Form';
  const assigneeId = form.assignee_id || null;
  const stageId = form.default_stage_id || null;

  // Remaining properties as custom_fields
  const customFields = {};
  const standardKeys = new Set(['name', 'fullName', 'full_name', 'email', 'phone', 'mobile', 'notes', 'message', 'comments']);
  for (const [k, v] of Object.entries(data)) {
    if (!standardKeys.has(k)) {
      customFields[k] = v;
    }
  }

  // 3. Create lead scoped strictly to form's tenant_id
  let createdLead = null;
  try {
    createdLead = await leadRepository.createLead(tenantId, {
      name,
      email,
      phone,
      source,
      stage_id: stageId,
      assignee_id: assigneeId,
      notes,
      custom_fields: customFields
    });
  } catch (leadErr) {
    logger.error('[LeadForm Submission] Error creating lead:', leadErr);
  }

  // 4. Record submission scoped to tenant_id
  const submission = await leadFormRepository.createSubmission(
    tenantId,
    form.id,
    data,
    ipAddress,
    userAgent,
    createdLead ? createdLead.id : null
  );

  return {
    success: true,
    message: form.success_message || 'Thank you! Your submission has been received.',
    redirectUrl: form.redirect_url || null,
    submissionId: submission.id
  };
}

module.exports = {
  processSubmission
};
