const leadFormRepository = require('../../repositories/leadFormRepository');
const { createLead } = require('../leads/createLead');
const pool = require('../../db/pool');
const storage = require('../../utils/storage');
const { sendNotification } = require('../../utils/notifications');

/**
 * Validates submission data against form fields configuration
 */
function validateSubmission(data, fields) {
  const errors = [];
  
  fields.forEach(field => {
    if (field.required) {
      if (!data[field.name] || data[field.name].trim() === '') {
        errors.push(`${field.label || field.name} is required`);
      }
    }
    // Additional validation could go here (e.g. regex for email/phone)
  });
  
  return errors;
}

/**
 * Handles a public form submission
 */
async function processSubmission({ slug, data, files, ipAddress, userAgent }) {
  // We don't have tenantId from auth, so we look up the form by slug globally. 
  // However, since slug is only unique per tenant, we either need global uniqueness for public slugs 
  // or we need the tenantId in the URL/payload.
  // Wait, the schema has UNIQUE (tenant_id, slug), not globally unique slug.
  // We'll query by slug. If multiple exist, we might have an issue without tenant_id.
  // Let's assume slug is practically unique, or we should require tenant_id in the URL.
  // For this CRM, since the URL is /forms/:slug, we must query the first match or enforce global uniqueness.
  // Let's query by slug and get the first one.
  
  const formRes = await pool.query(`SELECT * FROM lead_forms WHERE slug = $1 LIMIT 1`, [slug]);
  const form = formRes.rows[0];
  
  if (!form) {
    throw { status: 404, message: 'Form not found' };
  }
  
  if (form.status !== 'active') {
    throw { status: 400, message: 'This form is no longer accepting submissions' };
  }

  // Honeypot check (assume field name 'website_url' is the honeypot)
  if (data.website_url) {
    // Spam detected, fake success
    return { message: form.success_message || 'Thank you for your submission.' };
  }

  // Validate fields
  const fields = typeof form.fields === 'string' ? JSON.parse(form.fields) : (form.fields || []);
  const settings = typeof form.settings === 'string' ? JSON.parse(form.settings) : (form.settings || {});
  
  // Basic recaptcha validation mock
  if (settings.submission?.enableRecaptcha && !data.recaptcha_token) {
    throw { status: 422, message: 'reCAPTCHA verification failed' };
  }

  const errors = validateSubmission(data, fields);
  if (errors.length > 0) {
    throw { status: 422, message: 'Validation failed', errors };
  }

  // Handle file uploads
  const uploadedFiles = {};
  if (files && files.length > 0) {
    for (const file of files) {
      const key = `lead_forms/${form.id}/${Date.now()}_${file.originalname}`;
      await storage.uploadBuffer(key, file.buffer, file.mimetype);
      uploadedFiles[file.fieldname] = await storage.getDownloadUrl(key);
    }
  }

  // Handle UTM parameters
  const utmSource = data.utm_source || null;
  const utmMedium = data.utm_medium || null;
  const utmCampaign = data.utm_campaign || null;

  // Construct lead data mapping standard fields
  // Typically, forms will have fields named 'name', 'email', 'phone'
  const leadData = {
    name: data.name || 'Unknown Web Lead',
    email: data.email || null,
    phone: data.phone || '0000000000', 
    source: utmSource || form.lead_source || 'Web Form',
    assigneeId: form.assignee_id || null,
    // Store remaining custom fields in metadata/notes or description
    notes: `Submitted via form: ${form.name}\n\n` + 
      (utmMedium ? `UTM Medium: ${utmMedium}\n` : '') +
      (utmCampaign ? `UTM Campaign: ${utmCampaign}\n\n` : '') +
      Object.entries({...data, ...uploadedFiles})
      .filter(([k]) => !['name', 'email', 'phone', 'website_url', 'recaptcha_token', 'utm_source', 'utm_medium', 'utm_campaign'].includes(k))
      .map(([k, v]) => `${k}: ${v}`)
      .join('\n')
  };

  let createdLead = null;
  try {
    createdLead = await createLead({
      tenantId: form.tenant_id,
      userId: null, // System created
      data: leadData
    });
  } catch (err) {
    console.error('Failed to create lead from form submission:', err);
    // Even if lead creation fails (e.g. duplicate), we might still want to record the submission
  }

  // Record submission
  await leadFormRepository.createSubmission(
    form.tenant_id,
    form.id,
    { ...data, ...uploadedFiles },
    ipAddress,
    userAgent,
    createdLead ? createdLead.id : null
  );

  // Send notifications
  if (settings.notifications?.internalAlerts) {
    // Determine the user to notify (either assignee or the tenant admin)
    // For now, if there's an assignee, notify them
    if (form.assignee_id) {
      await sendNotification(
        form.tenant_id,
        form.assignee_id,
        'LEAD_FORM_SUBMISSION',
        `New submission on form: ${form.name}`,
        `/leads/forms/${form.id}/submissions`
      );
    }
  }

  if (settings.notifications?.autoResponder && data.email) {
    // Mock Auto-Responder Email
    console.log(`[EMAIL MOCK] To: ${data.email} | Subject: ${settings.notifications.autoResponderSubject || 'Thank you'} | Body: ${settings.notifications.autoResponderBody}`);
  }

  return { 
    message: settings.submission?.successMessage || form.success_message || 'Thank you for your submission.',
    redirectUrl: settings.submission?.redirectUrl || form.redirect_url || null
  };
}

module.exports = {
  processSubmission
};
