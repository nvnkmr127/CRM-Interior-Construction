const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { createPaymentMilestone, updatePaymentMilestone } = require('../services/projects/paymentMilestoneService');

const router = express.Router();

router.use(authenticate);

const createSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  amount: z.number().optional().nullable(),
  percent: z.number().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  milestoneId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable()
});

// POST /api/payment-milestones
router.post('/', authorize('projects:manage'), async (req, res, next) => {
  try {
    const data = createSchema.parse(req.body);
    // map percent -> percentage for service layer
    const mappedData = { ...data, percentage: data.percent };
    
    const milestone = await createPaymentMilestone({
      tenantId: req.tenantId,
      userId: req.user.userId,
      data: mappedData
    });
    return success(res, milestone, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    next(err);
  }
});

const updateSchema = z.object({
  status: z.string().optional(),
  invoice_reference: z.string().optional().nullable(),
  paid_at: z.string().optional().nullable(),
  paid_amount: z.number().optional().nullable()
});

// PATCH /api/payment-milestones/:id
router.patch('/:id', authorize('projects:manage'), async (req, res, next) => {
  try {
    const data = updateSchema.parse(req.body);
    
    const milestone = await updatePaymentMilestone({
      tenantId: req.tenantId,
      userId: req.user.userId,
      milestoneId: req.params.id,
      data
    });
    
    return success(res, milestone);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    if (err.message === 'NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Payment milestone not found', 404);
    }
    next(err);
  }
});

module.exports = router;
