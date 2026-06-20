const quotationService = require('../services/projects/quotationService');

exports.createQuotation = async (req, res, next) => {
  try {
    const data = { ...req.body, createdBy: req.user.id };
    const quotation = await quotationService.createQuotation(req.tenant.id, data);
    res.status(201).json({ success: true, data: quotation });
  } catch (error) {
    next(error);
  }
};

exports.getQuotation = async (req, res, next) => {
  try {
    const quotation = await quotationService.getQuotationWithItems(req.tenant.id, req.params.id);
    if (!quotation) {
      return res.status(404).json({ success: false, message: 'Quotation not found' });
    }
    res.status(200).json({ success: true, data: quotation });
  } catch (error) {
    next(error);
  }
};

exports.addBOQItem = async (req, res, next) => {
  try {
    const item = await quotationService.addBOQItem(req.tenant.id, req.params.id, req.body);
    res.status(201).json({ success: true, data: item });
  } catch (error) {
    next(error);
  }
};
