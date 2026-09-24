const materialSubstitutionService = require('../services/projects/materialSubstitutionService');

const getTenantId = (req) => req.tenantId || (req.tenant ? req.tenant.id : null);
const getUserId = (req) => req.user ? req.user.id : null;

exports.proposeSubstitution = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId } = req.params;
    const sub = await materialSubstitutionService.createMaterialSubstitution(tenantId, projectId, req.body);
    res.status(201).json({ success: true, data: sub });
  } catch (error) {
    if (error.message === 'PROJECT_NOT_FOUND' || error.message === 'BOQ item not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    next(error);
  }
};

exports.getProjectSubstitutions = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId } = req.params;
    const subs = await materialSubstitutionService.getMaterialSubstitutionsByProject(tenantId, projectId);
    res.status(200).json({ success: true, data: subs });
  } catch (error) {
    next(error);
  }
};

exports.getSubstitution = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId, id } = req.params;
    const sub = await materialSubstitutionService.getMaterialSubstitutionById(tenantId, projectId, id);
    if (!sub) {
      return res.status(404).json({ success: false, message: 'Material substitution request not found' });
    }
    res.status(200).json({ success: true, data: sub });
  } catch (error) {
    next(error);
  }
};

exports.respondToSubstitution = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId, id } = req.params;
    const sub = await materialSubstitutionService.respondToSubstitution(tenantId, userId, projectId, id, req.body);
    res.status(200).json({ success: true, data: sub });
  } catch (error) {
    if (error.message === 'Material substitution request not found') {
      return res.status(404).json({ success: false, message: error.message });
    }
    if (error.message.includes('Invalid response status')) {
      return res.status(400).json({ success: false, message: error.message });
    }
    next(error);
  }
};
