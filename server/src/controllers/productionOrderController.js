const productionOrderService = require('../services/projects/productionOrderService');

const getTenantId = (req) => req.tenantId || (req.tenant ? req.tenant.id : null);
const getUserId = (req) => req.user ? req.user.id : null;

exports.createProductionOrder = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId } = req.params;
    const po = await productionOrderService.createProductionOrder(tenantId, userId, projectId, req.body);
    res.status(201).json({ success: true, data: po });
  } catch (error) {
    next(error);
  }
};

exports.getProjectProductionOrders = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId } = req.params;
    const pos = await productionOrderService.getProductionOrdersByProject(tenantId, projectId);
    res.status(200).json({ success: true, data: pos });
  } catch (error) {
    next(error);
  }
};

exports.getProductionOrder = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId, id } = req.params;
    const po = await productionOrderService.getProductionOrderById(tenantId, projectId, id);
    if (!po) {
      return res.status(404).json({ success: false, message: 'Production Order not found' });
    }
    res.status(200).json({ success: true, data: po });
  } catch (error) {
    next(error);
  }
};

exports.updateProductionOrder = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId, id } = req.params;
    const po = await productionOrderService.updateProductionOrder(tenantId, projectId, id, req.body);
    if (!po) {
      return res.status(404).json({ success: false, message: 'Production Order not found' });
    }
    res.status(200).json({ success: true, data: po });
  } catch (error) {
    next(error);
  }
};

exports.updateProductionOrderItem = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId, id, itemId } = req.params;
    const item = await productionOrderService.updateProductionOrderItem(tenantId, projectId, id, itemId, req.body);
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

exports.recordQCInspection = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId, id, itemId } = req.params;
    const inspection = await productionOrderService.recordQCInspection(tenantId, userId, projectId, id, itemId, req.body);
    res.status(201).json({ success: true, data: inspection });
  } catch (error) {
    next(error);
  }
};

exports.createReworkOrder = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId, id, itemId } = req.params;
    const rework = await productionOrderService.createReworkOrder(tenantId, userId, projectId, id, itemId, req.body);
    res.status(201).json({ success: true, data: rework });
  } catch (error) {
    next(error);
  }
};

exports.updateReworkOrderStatus = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId, id, reworkId } = req.params;
    const rework = await productionOrderService.updateReworkOrderStatus(tenantId, projectId, id, reworkId, req.body);
    res.status(200).json({ success: true, data: rework });
  } catch (error) {
    next(error);
  }
};

exports.clearOrderForDispatch = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId, id } = req.params;
    const po = await productionOrderService.clearOrderForDispatch(tenantId, userId, projectId, id);
    res.status(200).json({ success: true, data: po });
  } catch (error) {
    next(error);
  }
};

exports.getQCAndReworkSummary = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId, id } = req.params;
    const summary = await productionOrderService.getQCAndReworkSummary(tenantId, projectId, id);
    res.status(200).json({ success: true, data: summary });
  } catch (error) {
    next(error);
  }
};

exports.dispatchProductionOrder = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId, id } = req.params;
    const dispatch = await productionOrderService.dispatchProductionOrder(tenantId, userId, projectId, id, req.body);
    res.status(201).json({ success: true, data: dispatch });
  } catch (error) {
    next(error);
  }
};

exports.confirmSiteDelivery = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId, id, dispatchId } = req.params;
    const dispatch = await productionOrderService.confirmSiteDelivery(tenantId, userId, projectId, id, dispatchId, req.body);
    res.status(200).json({ success: true, data: dispatch });
  } catch (error) {
    next(error);
  }
};

exports.getDispatchRecords = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId, id } = req.params;
    const dispatches = await productionOrderService.getDispatchRecords(tenantId, projectId, id);
    res.status(200).json({ success: true, data: dispatches });
  } catch (error) {
    next(error);
  }
};

exports.createTransitDamageReport = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId, dispatchId, itemId } = req.params;
    const damage = await productionOrderService.createTransitDamageReport(tenantId, userId, projectId, dispatchId, itemId, req.body);
    res.status(201).json({ success: true, data: damage });
  } catch (error) {
    next(error);
  }
};

exports.initiateReplacementOrder = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId, damageId } = req.params;
    const result = await productionOrderService.initiateReplacementOrder(tenantId, userId, projectId, damageId);
    res.status(201).json({ success: true, data: result });
  } catch (error) {
    next(error);
  }
};

exports.updateTransitDamageStatus = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId, damageId } = req.params;
    const damage = await productionOrderService.updateTransitDamageStatus(tenantId, projectId, damageId, req.body);
    res.status(200).json({ success: true, data: damage });
  } catch (error) {
    next(error);
  }
};

exports.getTransitDamageRecords = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId, id } = req.params;
    const damages = await productionOrderService.getTransitDamageRecords(tenantId, projectId, id);
    res.status(200).json({ success: true, data: damages });
  } catch (error) {
    next(error);
  }
};

exports.getCuttingList = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { itemId } = req.params;
    const panels = await productionOrderService.getCuttingListByItem(tenantId, itemId);
    res.status(200).json({ success: true, data: panels });
  } catch (error) {
    next(error);
  }
};

exports.saveCuttingList = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { itemId } = req.params;
    const panels = await productionOrderService.saveCuttingList(tenantId, itemId, req.body.panels);
    res.status(200).json({ success: true, data: panels });
  } catch (error) {
    next(error);
  }
};

exports.getCNCRequests = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params; // orderId
    const requests = await productionOrderService.getCNCRequestsByOrder(tenantId, id);
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
};

exports.createCNCRequest = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId, id } = req.params; // projectId, orderId
    const request = await productionOrderService.createCNCRequest(tenantId, userId, projectId, id, req.body);
    res.status(201).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

exports.updateCNCRequestStatus = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { requestId } = req.params;
    const { status, programFileName, notes } = req.body;
    const request = await productionOrderService.updateCNCRequestStatus(tenantId, requestId, status, programFileName, notes);
    res.status(200).json({ success: true, data: request });
  } catch (error) {
    next(error);
  }
};

exports.getGlobalProductionOrders = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { search, status } = req.query;
    const pos = await productionOrderService.getGlobalProductionOrders(tenantId, search, status);
    res.status(200).json({ success: true, data: pos });
  } catch (error) {
    next(error);
  }
};

exports.getGlobalCNCRequests = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const requests = await productionOrderService.getGlobalCNCRequests(tenantId);
    res.status(200).json({ success: true, data: requests });
  } catch (error) {
    next(error);
  }
};


