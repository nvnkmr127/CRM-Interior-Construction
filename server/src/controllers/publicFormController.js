const pool = require('../db/pool');
const { success, fail } = require('../utils/response');
const submissionService = require('../services/leadForms/submissionService');
const leadFormRepository = require('../repositories/leadFormRepository');

exports.getFormBySlug = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const formRes = await pool.query(`SELECT id, tenant_id, name, description, fields, settings, status FROM lead_forms WHERE slug = $1 LIMIT 1`, [slug]);
    const form = formRes.rows[0];

    if (!form) return fail(res, 'NOT_FOUND', 'Form not found', 404);
    if (form.status !== 'active') return fail(res, 'BAD_REQUEST', 'Form is inactive', 400);

    // Increment view count asynchronously
    leadFormRepository.incrementFormViews(form.tenant_id, form.id).catch(console.error);

    // Only return safe public fields (don't expose internal config like assignee)
    return success(res, {
      name: form.name,
      description: form.description,
      fields: typeof form.fields === 'string' ? JSON.parse(form.fields) : form.fields,
      settings: typeof form.settings === 'string' ? JSON.parse(form.settings) : (form.settings || {}),
      slug
    });
  } catch (error) {
    next(error);
  }
};

exports.submitForm = async (req, res, next) => {
  try {
    const { slug } = req.params;
    const data = req.body;
    const files = req.files || [];
    const ipAddress = req.ip || req.connection.remoteAddress;
    const userAgent = req.get('user-agent');

    const result = await submissionService.processSubmission({ slug, data, files, ipAddress, userAgent });
    return success(res, result);
  } catch (error) {
    if (error.status) {
      return res.status(error.status).json({ success: false, error: error.message, errors: error.errors });
    }
    next(error);
  }
};
