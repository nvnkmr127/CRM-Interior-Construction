const vendorLeadTimeService = require('../services/projects/vendorLeadTimeService');

const getTenantId = (req) => req.tenantId || (req.tenant ? req.tenant.id : null);

exports.listLeadTimes = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const leadTimes = await vendorLeadTimeService.listLeadTimes(tenantId);
    res.status(200).json({ success: true, data: leadTimes });
  } catch (error) {
    next(error);
  }
};

exports.saveLeadTime = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const leadTime = await vendorLeadTimeService.saveLeadTime(tenantId, req.body);
    res.status(200).json({ success: true, data: leadTime });
  } catch (error) {
    next(error);
  }
};

exports.deleteLeadTime = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    await vendorLeadTimeService.deleteLeadTime(tenantId, id);
    res.status(200).json({ success: true, message: 'Vendor lead time configuration deleted successfully' });
  } catch (error) {
    next(error);
  }
};
