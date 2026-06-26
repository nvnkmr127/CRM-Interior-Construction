const materialDeliveryService = require('../services/projects/materialDeliveryService');

const getTenantId = (req) => req.tenantId || (req.tenant ? req.tenant.id : null);
const getUserId = (req) => req.user ? req.user.id : null;

exports.createMaterialDelivery = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId } = req.params;
    const delivery = await materialDeliveryService.createMaterialDelivery(tenantId, userId, projectId, req.body);
    res.status(201).json({ success: true, data: delivery });
  } catch (error) {
    next(error);
  }
};

exports.getProjectMaterialDeliveries = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId } = req.params;
    const deliveries = await materialDeliveryService.getMaterialDeliveriesByProject(tenantId, projectId);
    res.status(200).json({ success: true, data: deliveries });
  } catch (error) {
    next(error);
  }
};

exports.getMaterialDelivery = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId, id } = req.params;
    const delivery = await materialDeliveryService.getMaterialDeliveryById(tenantId, projectId, id);
    if (!delivery) {
      return res.status(404).json({ success: false, message: 'Material delivery not found' });
    }
    res.status(200).json({ success: true, data: delivery });
  } catch (error) {
    next(error);
  }
};

exports.updateMaterialDelivery = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId, id } = req.params;
    const delivery = await materialDeliveryService.updateMaterialDelivery(tenantId, userId, projectId, id, req.body);
    res.status(200).json({ success: true, data: delivery });
  } catch (error) {
    next(error);
  }
};
