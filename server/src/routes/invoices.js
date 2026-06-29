const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const {
  getInvoiceByMilestone,
  getInvoiceById,
  getInvoiceDraftDetails,
  createInvoice
} = require('../services/projects/invoiceService');

const router = express.Router();

router.use(authenticate);

const createInvoiceSchema = z.object({
  milestoneId: z.string().uuid(),
  invoiceDate: z.string().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  companyName: z.string().optional().nullable(),
  companyAddress: z.string().optional().nullable(),
  companyGstin: z.string().optional().nullable(),
  billingName: z.string().optional().nullable(),
  billingAddress: z.string().optional().nullable(),
  billingGstin: z.string().optional().nullable(),
  gstType: z.enum(['cgst_sgst', 'igst']).optional().nullable(),
  gstRate: z.number().optional().nullable(),
  paymentTerms: z.string().optional().nullable(),
  hsnCode: z.string().optional().nullable(),
  taxTreatment: z.enum(['itemized', 'works_contract', 'composite_supply']).optional().nullable()
});

// GET /api/invoices/milestone/:milestoneId
router.get('/milestone/:milestoneId', authorize('projects:read'), async (req, res, next) => {
  try {
    const invoice = await getInvoiceByMilestone(req.tenantId, req.params.milestoneId);
    if (!invoice) {
      return fail(res, 'NOT_FOUND', 'Invoice not found for this milestone', 404);
    }
    return success(res, invoice);
  } catch (err) {
    next(err);
  }
});

// GET /api/invoices/milestone/:milestoneId/download
router.get('/milestone/:milestoneId/download', authorize('projects:read'), async (req, res, next) => {
  try {
    const invoice = await getInvoiceByMilestone(req.tenantId, req.params.milestoneId);
    if (!invoice) {
      return fail(res, 'NOT_FOUND', 'Invoice not found for this milestone', 404);
    }

    if (!invoice.pdf_storage_key) {
      return fail(res, 'NOT_FOUND', 'PDF file not generated yet', 404);
    }

    const storage = require('../utils/storage');
    const env = require('../config/env');

    if (env.storageProvider === 'local') {
      const path = require('path');
      const fs = require('fs');
      const filePath = path.join(__dirname, '../../../uploads', invoice.pdf_storage_key);
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
        return fs.createReadStream(filePath).pipe(res);
      } else {
        return fail(res, 'NOT_FOUND', 'Invoice PDF file not found on local disk', 404);
      }
    } else {
      const downloadUrl = await storage.getDownloadUrl(invoice.pdf_storage_key);
      return res.redirect(downloadUrl);
    }
  } catch (err) {
    next(err);
  }
});

// GET /api/invoices/milestone/:milestoneId/draft
router.get('/milestone/:milestoneId/draft', authorize('projects:read'), async (req, res, next) => {
  try {
    const draft = await getInvoiceDraftDetails(req.tenantId, req.params.milestoneId);
    return success(res, draft);
  } catch (err) {
    if (err.message === 'MILESTONE_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Milestone not found', 404);
    }
    if (err.message === 'PROJECT_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Linked project not found', 404);
    }
    next(err);
  }
});

// POST /api/invoices
router.post('/', authorize('finance:invoices'), async (req, res, next) => {
  try {
    const data = createInvoiceSchema.parse(req.body);
    
    const invoice = await createInvoice({
      tenantId: req.tenantId,
      userId: req.user.userId,
      milestoneId: data.milestoneId,
      data
    });
    
    return success(res, invoice, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    if (err.message === 'INVOICE_ALREADY_EXISTS') {
      return fail(res, 'CONFLICT', 'An invoice has already been generated for this milestone.', 409);
    }
    if (err.message === 'MILESTONE_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Milestone not found', 404);
    }
    if (err.message === 'PROJECT_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    next(err);
  }
});

// GET /api/invoices/:id/download
router.get('/:id/download', authorize('projects:read'), async (req, res, next) => {
  try {
    const invoice = await getInvoiceById(req.tenantId, req.params.id);
    if (!invoice) {
      return fail(res, 'NOT_FOUND', 'Invoice not found', 404);
    }

    if (!invoice.pdf_storage_key) {
      return fail(res, 'NOT_FOUND', 'PDF file not generated yet', 404);
    }

    const storage = require('../utils/storage');
    const env = require('../config/env');

    if (env.storageProvider === 'local') {
      const path = require('path');
      const fs = require('fs');
      // Look up files in uploads directory
      const filePath = path.join(__dirname, '../../../uploads', invoice.pdf_storage_key);
      if (fs.existsSync(filePath)) {
        res.setHeader('Content-Type', 'application/pdf');
        res.setHeader('Content-Disposition', `attachment; filename="${invoice.invoice_number}.pdf"`);
        return fs.createReadStream(filePath).pipe(res);
      } else {
        return fail(res, 'NOT_FOUND', 'Invoice PDF file not found on local disk', 404);
      }
    } else {
      const downloadUrl = await storage.getDownloadUrl(invoice.pdf_storage_key);
      return res.redirect(downloadUrl);
    }
  } catch (err) {
    next(err);
  }
});

module.exports = router;
