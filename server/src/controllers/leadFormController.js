const leadFormRepository = require('../repositories/leadFormRepository');
const { success, fail } = require('../utils/response');

function getTenantAndUser(req) {
  return {
    tenantId: req.tenantId || (req.user && req.user.tenantId),
    userId: req.userId || (req.user && req.user.id)
  };
}

exports.getForms = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const forms = await leadFormRepository.getForms(tenantId);
    return success(res, forms);
  } catch (error) {
    next(error);
  }
};

exports.getFormById = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const form = await leadFormRepository.getFormById(tenantId, req.params.id);
    if (!form) return fail(res, 'NOT_FOUND', 'Form not found', 404);
    return success(res, form);
  } catch (error) {
    next(error);
  }
};

exports.createForm = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const data = req.body;
    
    // Ensure slug is provided or generate one
    if (!data.slug) {
      data.slug = data.name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/(^-|-$)+/g, '');
    }

    const form = await leadFormRepository.createForm(tenantId, data);
    return success(res, form, 201);
  } catch (error) {
    if (error.code === '23505') { // unique violation
      return fail(res, 'CONFLICT', 'Form slug already exists', 409);
    }
    next(error);
  }
};

exports.updateForm = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const formId = req.params.id;
    const data = req.body;
    
    const form = await leadFormRepository.updateForm(tenantId, formId, data);
    if (!form) return fail(res, 'NOT_FOUND', 'Form not found', 404);
    
    return success(res, form);
  } catch (error) {
    if (error.code === '23505') {
      return fail(res, 'CONFLICT', 'Form slug already exists', 409);
    }
    next(error);
  }
};

exports.deleteForm = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    await leadFormRepository.deleteForm(tenantId, req.params.id);
    return success(res, { message: 'Form deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getFormSubmissions = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const submissions = await leadFormRepository.getSubmissionsByFormId(tenantId, req.params.id);
    return success(res, submissions);
  } catch (error) {
    next(error);
  }
};
