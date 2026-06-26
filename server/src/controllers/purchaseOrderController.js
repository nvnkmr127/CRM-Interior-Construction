const purchaseOrderService = require('../services/projects/purchaseOrderService');

const getTenantId = (req) => req.tenantId || (req.tenant ? req.tenant.id : null);
const getUserId = (req) => req.user ? req.user.id : null;

exports.createPurchaseOrder = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId } = req.params;
    const po = await purchaseOrderService.createPurchaseOrder(tenantId, userId, projectId, req.body);
    res.status(201).json({ success: true, data: po });
  } catch (error) {
    next(error);
  }
};

exports.getProjectPurchaseOrders = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId } = req.params;
    const pos = await purchaseOrderService.getPurchaseOrdersByProject(tenantId, projectId);
    res.status(200).json({ success: true, data: pos });
  } catch (error) {
    next(error);
  }
};

exports.getPurchaseOrder = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId, id } = req.params;
    const po = await purchaseOrderService.getPurchaseOrderById(tenantId, projectId, id);
    if (!po) {
      return res.status(404).json({ success: false, message: 'Purchase Order not found' });
    }
    res.status(200).json({ success: true, data: po });
  } catch (error) {
    next(error);
  }
};

exports.updatePurchaseOrder = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId, id } = req.params;
    const po = await purchaseOrderService.updatePurchaseOrder(tenantId, userId, projectId, id, req.body);
    res.status(200).json({ success: true, data: po });
  } catch (error) {
    next(error);
  }
};

exports.updatePOItemReceipt = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId, id, itemId } = req.params;
    const po = await purchaseOrderService.updatePOItemReceipt(tenantId, userId, projectId, id, itemId, req.body);
    res.status(200).json({ success: true, data: po });
  } catch (error) {
    next(error);
  }
};
