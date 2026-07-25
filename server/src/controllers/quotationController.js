const quotationService = require('../services/projects/quotationService');
const { stripUnauthorizedEdits, filterAllowedFields } = require('../utils/fieldMasker');

const getTenantId = (req) => req.tenantId || (req.tenant ? req.tenant.id : null);
const getUserId = (req) => req.user ? req.user.id : null;

exports.createQuotation = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { projectId } = req.params;
    let data = { ...req.body, createdBy: userId, projectId: projectId || req.body.projectId };
    data = stripUnauthorizedEdits(data, req.user, 'quotations');
    let quotation = await quotationService.createQuotation(tenantId, data);
    quotation = filterAllowedFields(quotation, req.user, 'quotations');
    res.status(201).json({ success: true, data: quotation });
  } catch (error) {
    next(error);
  }
};

exports.getQuotation = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    let quotation = await quotationService.getQuotationWithItems(tenantId, req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }
    quotation = filterAllowedFields(quotation, req.user, 'quotations');
    res.status(200).json({ success: true, data: quotation });
  } catch (error) {
    next(error);
  }
};

exports.getProjectQuotations = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { projectId } = req.params;
    let quotations = await quotationService.getQuotationsByProjectId(tenantId, projectId);
    quotations = quotations.map(q => filterAllowedFields(q, req.user, 'quotations'));
    res.status(200).json({ success: true, data: quotations });
  } catch (error) {
    next(error);
  }
};

exports.addBOQItem = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const item = await quotationService.addBOQItem(tenantId, req.params.id, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

exports.updateBOQItem = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { itemId } = req.params;
    const item = await quotationService.updateBOQItem(tenantId, itemId, req.body);
    if (!item) {
      return res.status(404).json({ success: false, message: 'BOQ Item not found' });
    }
    res.status(200).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};

exports.deleteBOQItem = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { itemId } = req.params;
    const success = await quotationService.deleteBOQItem(tenantId, itemId);
    if (!success) {
      return res.status(404).json({ success: false, message: 'BOQ Item not found' });
    }
    res.status(200).json({ success: true, data: { message: 'BOQ Item deleted' } });
  } catch (error) {
    next(error);
  }
};

exports.reviseQuotation = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { id } = req.params;
    const { changeReason } = req.body;
    if (!changeReason || changeReason.trim() === '') {
      return res.status(400).json({ success: false, message: 'Change reason is required to revise quotation' });
    }
    const quotation = await quotationService.reviseQuotation(tenantId, id, userId, changeReason);
    res.status(201).json({ success: true, data: quotation });
  } catch (error) {
    next(error);
  }
};

exports.compareQuotations = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { id, targetId } = req.params;
    const comparison = await quotationService.compareQuotations(tenantId, id, targetId);
    res.status(200).json({ success: true, data: comparison });
  } catch (error) {
    next(error);
  }
};

exports.sendQuotation = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const quotation = await quotationService.sendQuotation(tenantId, id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found or not in draft status' });
    }
    res.status(200).json({ success: true, data: quotation });
  } catch (error) {
    next(error);
  }
};

exports.acceptQuotation = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const quotation = await quotationService.acceptQuotation(tenantId, id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found or cannot be accepted' });
    }
    res.status(200).json({ success: true, data: quotation });
  } catch (error) {
    next(error);
  }
};

exports.rejectQuotation = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const { id } = req.params;
    const quotation = await quotationService.rejectQuotation(tenantId, id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found or cannot be rejected' });
    }
    res.status(200).json({ success: true, data: quotation });
  } catch (error) {
    next(error);
  }
};

exports.updateQuotation = async (req, res, next) => {
  try {
    const tenantId = getTenantId(req);
    const userId = getUserId(req);
    const { id } = req.params;

    // Check if trying to update discount amount
    if (req.body.discountAmount !== undefined) {
      const permissions = req.user.permissions || [];
      if (req.user.role !== 'superadmin' && !permissions.includes('finance:discounts')) {
        return res.status(403).json({
          success: false,
          error: 'FORBIDDEN',
          required: 'finance:discounts'
        });
      }
    }

    let bodyData = stripUnauthorizedEdits(req.body, req.user, 'quotations');

    let quotation = await quotationService.updateQuotation(tenantId, id, bodyData, userId);
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }
    quotation = filterAllowedFields(quotation, req.user, 'quotations');
    res.status(200).json({ success: true, data: quotation });
  } catch (error) {
    next(error);
  }
};

