const purchaseRequestService = require('../services/projects/purchaseRequestService');

const getTenantId = (req) => req.tenantId || (req.tenant ? req.tenant.id : null);
const getUserId = (req) => req.user ? req.user.id : null;

exports.createPurchaseRequest = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId } = req.params;
    const pr = await purchaseRequestService.createPurchaseRequest(tenantId, userId, projectId, req.body);
    res.status(201).json({ success: true, data: pr });
  } catch (error) {
    next(error);
  }
};

exports.getProjectPurchaseRequests = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId } = req.params;
    const prs = await purchaseRequestService.getPurchaseRequestsByProject(tenantId, projectId);
    res.status(200).json({ success: true, data: prs });
  } catch (error) {
    next(error);
  }
};

exports.getPurchaseRequest = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId, id } = req.params;
    const pr = await purchaseRequestService.getPurchaseRequestById(tenantId, projectId, id);
    if (!pr) {
      return res.status(404).json({ success: false, message: 'Purchase Request not found' });
    }
    res.status(200).json({ success: true, data: pr });
  } catch (error) {
    next(error);
  }
};

exports.updatePurchaseRequest = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId, id } = req.params;
    const pr = await purchaseRequestService.updatePurchaseRequest(tenantId, userId, projectId, id, req.body);
    res.status(200).json({ success: true, data: pr });
  } catch (error) {
    next(error);
  }
};

exports.convertToPurchaseOrder = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId, id } = req.params;
    const po = await purchaseRequestService.convertToPurchaseOrder(tenantId, userId, projectId, id, req.body);
    res.status(201).json({ success: true, data: po });
  } catch (error) {
    next(error);
  }
};
