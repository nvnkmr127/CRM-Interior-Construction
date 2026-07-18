const express = require('express');
const { z } = require('zod');
const { success } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const authorize = require('../middleware/authorize');
const {
  getCreditNotes,
  getRefunds,
  createCreditNote,
  createRefund
} = require('../services/projects/financialService');

const router = express.Router();

router.use(authenticate);

const createCreditNoteSchema = z.object({
  projectId: z.string().uuid(),
  invoiceId: z.string().uuid().optional().nullable(),
  subtotal: z.number().nonnegative(),
  gstType: z.enum(['cgst_sgst', 'igst']).optional().nullable(),
  gstRate: z.number().nonnegative().optional().nullable(),
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional().nullable(),
  creditNoteDate: z.string().optional().nullable()
});

const createRefundSchema = z.object({
  projectId: z.string().uuid(),
  paymentMilestoneId: z.string().uuid().optional().nullable(),
  amount: z.number().positive(),
  paymentMethod: z.string().min(1, 'Payment method is required'),
  referenceNumber: z.string().optional().nullable(),
  reason: z.string().min(1, 'Reason is required'),
  notes: z.string().optional().nullable(),
  refundDate: z.string().optional().nullable()
});

// GET /api/financials/projects/:projectId/credit-notes
router.get('/projects/:projectId/credit-notes', authorize('projects:read'), async (req, res, next) => {
  try {
    const creditNotes = await getCreditNotes(req.tenantId, req.params.projectId);
    return success(res, creditNotes);
  } catch (err) {
    next(err);
  }
});

// POST /api/financials/credit-notes
router.post('/credit-notes', authorize('finance:credits'), validate(createCreditNoteSchema), async (req, res, next) => {
  try {
    const data  = req.body;
    const creditNote = await createCreditNote({
      tenantId: req.tenantId,
      userId: req.user.userId,
      data
    });
    return success(res, creditNote, {}, 201);
  } catch (err) {
    
    next(err);
  }
});

// GET /api/financials/projects/:projectId/refunds
router.get('/projects/:projectId/refunds', authorize('projects:read'), async (req, res, next) => {
  try {
    const refunds = await getRefunds(req.tenantId, req.params.projectId);
    return success(res, refunds);
  } catch (err) {
    next(err);
  }
});

// POST /api/financials/refunds
router.post('/refunds', authorize('finance:credits'), validate(createRefundSchema), async (req, res, next) => {
  try {
    const data  = req.body;
    const refund = await createRefund({
      tenantId: req.tenantId,
      userId: req.user.userId,
      data
    });
    return success(res, refund, {}, 201);
  } catch (err) {
    
    next(err);
  }
});

module.exports = router;
