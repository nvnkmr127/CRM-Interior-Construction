const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const authorize = require('../middleware/authorize');
const siteExpenseRepository = require('../repositories/siteExpenseRepository');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const submitExpenseSchema = z.object({
  phaseId: z.string().uuid().optional().nullable(),
  expenseType: z.enum(['material', 'labour_advance', 'transport', 'miscellaneous']),
  amount: z.number().positive('Amount must be positive'),
  description: z.string().min(1, 'Description is required'),
  receiptPhotoUrl: z.string().min(1, 'Receipt photo is required')
});

const updateStatusSchema = z.object({
  status: z.enum(['approved', 'rejected'])
});

// POST /api/projects/:projectId/site-expenses
router.post('/', authorize('projects:manage'), validate(submitExpenseSchema), async (req, res, next) => {
  try {
    const data  = req.body;
    const mappedData = {
      phase_id: data.phaseId,
      expense_type: data.expenseType,
      amount: data.amount,
      description: data.description,
      receipt_photo_url: data.receiptPhotoUrl
    };

    const expense = await siteExpenseRepository.submitExpense(
      req.tenantId,
      req.params.projectId,
      req.user?.userId,
      mappedData
    );

    return success(res, expense, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors || err.issues, 400);
    console.error('[SiteExpenses Router] Submit error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to submit site expense.', 500);
  }
});

// PATCH /api/projects/:projectId/site-expenses/:id/status
router.patch('/:id/status', authorize('projects:manage'), validate(updateStatusSchema), async (req, res, next) => {
  try {
    const { status }  = req.body;

    const expense = await siteExpenseRepository.updateExpenseStatus(
      req.tenantId,
      req.params.id,
      status,
      req.user?.userId
    );

    if (!expense) {
      return fail(res, 'NOT_FOUND', 'Site expense not found.', 404);
    }

    return success(res, expense);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors || err.issues, 400);
    console.error('[SiteExpenses Router] Update status error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update site expense status.', 500);
  }
});

// PATCH /api/projects/:projectId/site-expenses/:id/reimburse
router.patch('/:id/reimburse', authorize('projects:manage'), async (req, res) => {
  try {
    const expense = await siteExpenseRepository.markReimbursed(
      req.tenantId,
      req.params.id
    );

    if (!expense) {
      return fail(res, 'NOT_FOUND', 'Approved site expense not found.', 404);
    }

    return success(res, expense);
  } catch (err) {
    console.error('[SiteExpenses Router] Reimburse error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to mark site expense as reimbursed.', 500);
  }
});

// GET /api/projects/:projectId/site-expenses
router.get('/', authorize('projects:read'), async (req, res) => {
  try {
    const expenses = await siteExpenseRepository.findExpensesByProject(
      req.tenantId,
      req.params.projectId
    );
    return success(res, expenses);
  } catch (err) {
    console.error('[SiteExpenses Router] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch site expenses.', 500);
  }
});

module.exports = router;
