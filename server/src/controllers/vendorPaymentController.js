const vendorPaymentService = require('../services/projects/vendorPaymentService');

const getTenantId = (req) => req.tenantId || (req.tenant ? req.tenant.id : null);
const getUserId = (req) => req.user ? req.user.id : null;

exports.createVendorPaymentMilestone = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId } = req.params;
    const milestone = await vendorPaymentService.createVendorPaymentMilestone(tenantId, projectId, req.body);
    res.status(201).json({ success: true, data: milestone });
  } catch (error) {
    next(error);
  }
};

exports.getProjectVendorPaymentMilestones = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId } = req.params;
    const milestones = await vendorPaymentService.getVendorPaymentMilestonesByProject(tenantId, projectId);
    res.status(200).json({ success: true, data: milestones });
  } catch (error) {
    next(error);
  }
};

exports.getVendorPaymentMilestone = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId, id } = req.params;
    const milestone = await vendorPaymentService.getVendorPaymentMilestoneById(tenantId, projectId, id);
    if (!milestone) {
      return res.status(404).json({ success: false, message: 'Vendor payment milestone not found' });
    }
    res.status(200).json({ success: true, data: milestone });
  } catch (error) {
    next(error);
  }
};

exports.updateVendorPaymentMilestone = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId, id } = req.params;
    const milestone = await vendorPaymentService.updateVendorPaymentMilestone(tenantId, userId, projectId, id, req.body);
    res.status(200).json({ success: true, data: milestone });
  } catch (error) {
    next(error);
  }
};

exports.deleteVendorPaymentMilestone = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId, id } = req.params;
    const success = await vendorPaymentService.deleteVendorPaymentMilestone(tenantId, projectId, id);
    if (!success) {
      return res.status(404).json({ success: false, message: 'Vendor payment milestone not found' });
    }
    res.status(200).json({ success: true, data: { message: 'Vendor payment milestone deleted' } });
  } catch (error) {
    next(error);
  }
};
