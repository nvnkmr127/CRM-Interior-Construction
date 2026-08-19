const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const authorize = require('../middleware/authorize');
const { createPaymentMilestone, updatePaymentMilestone } = require('../services/projects/paymentMilestoneService');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

router.get('/', async (req, res, next) => {
  const projectId = req.params.id || req.params.projectId;
  const tenantId = req.tenantId;

  try {
    const pool = require('../config/db');
    let rows;

    if (projectId) {
      const result = await pool.query(`
        SELECT pm.*, m.name as milestone_name
        FROM payment_milestones pm
        LEFT JOIN milestones m ON m.id=pm.milestone_id
        WHERE pm.project_id=$1 AND pm.tenant_id=$2
        ORDER BY pm.due_date ASC NULLS LAST
      `, [projectId, tenantId]);
      rows = result.rows;
    } else {
      const result = await pool.query(`
        SELECT pm.*, m.name as milestone_name, p.name as project_name
        FROM payment_milestones pm
        LEFT JOIN milestones m ON m.id=pm.milestone_id
        LEFT JOIN projects p ON p.id=pm.project_id
        WHERE pm.tenant_id=$1
        ORDER BY pm.due_date ASC NULLS LAST
      `, [tenantId]);
      rows = result.rows;
    }

    return success(res, rows);
  } catch (error) {
    next(error);
  }
});

const createSchema = z.object({
  projectId: z.string().uuid(),
  name: z.string().min(1),
  amount: z.number().optional().nullable(),
  percent: z.number().optional().nullable(),
  dueDate: z.string().optional().nullable(),
  milestoneId: z.string().uuid().optional().nullable(),
  notes: z.string().optional().nullable(),
  tdsRate: z.number().optional().nullable(),
  tdsAmount: z.number().optional().nullable()
});

// POST /api/payment-milestones
router.post('/', authorize('payments:create'), validate(createSchema), async (req, res, next) => {
  try {
    const data  = req.body;
    // map percent -> percentage for service layer
    const mappedData = { 
      ...data, 
      percentage: data.percent,
      tdsRate: data.tdsRate,
      tdsAmount: data.tdsAmount
    };
    
    const milestone = await createPaymentMilestone({
      tenantId: req.tenantId,
      userId: req.user.userId,
      data: mappedData
    });
    return success(res, milestone, {}, 201);
  } catch (error) {
    
    next(error);
  }
});

const updateSchema = z.object({
  status: z.string().optional(),
  invoice_reference: z.string().optional().nullable(),
  paid_at: z.string().optional().nullable(),
  paid_amount: z.number().optional().nullable(),
  tds_rate: z.number().optional().nullable(),
  tds_amount: z.number().optional().nullable(),
  is_deferred: z.boolean().optional(),
  deferral_reference: z.string().optional().nullable()
});

// PATCH /api/payment-milestones/:id
router.patch('/:id', authorize('payments:edit'), validate(updateSchema), async (req, res, next) => {
  try {
    const data  = req.body;
    
    const milestone = await updatePaymentMilestone({
      tenantId: req.tenantId,
      userId: req.user.userId,
      milestoneId: req.params.id,
      data
    });
    
    return success(res, milestone);
  } catch (error) {
    
    if (error.message === 'NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Payment milestone not found', 404);
    }
    next(error);
  }
});

module.exports = router;
