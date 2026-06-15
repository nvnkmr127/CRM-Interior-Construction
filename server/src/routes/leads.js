const express = require('express');
const { z } = require('zod');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { createLead } = require('../services/leads/createLead');
const { updateLead } = require('../services/leads/updateLead');
const { deleteLead } = require('../services/leads/deleteLead');
const { changeStage } = require('../services/leads/changeStage');
const { findLeads, findLeadById } = require('../repositories/leadRepository');
const { listActivities, logActivity } = require('../services/activities/activityService');
const { success, fail, paginate } = require('../utils/response');

const router = express.Router();

const createLeadSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  phone: z.string(),
  email: z.string().email('Invalid email format').optional().or(z.literal('')),
  source: z.string().optional(),
  stageId: z.string().uuid('Invalid stage ID').optional(),
  assigneeId: z.string().uuid('Invalid assignee ID').optional(),
  notes: z.string().optional(),
  custom_fields: z.record(z.any()).optional()
});

const logActivitySchema = z.object({
  type: z.enum(['call', 'note', 'email', 'whatsapp', 'site_visit', 'meeting']),
  title: z.string().optional(),
  notes: z.string(),
  outcome: z.string().optional(),
  scheduledAt: z.string().datetime().optional()
});

router.post('/', authenticate, authorize('leads:create'), async (req, res, next) => {
  try {
    const parsed = createLeadSchema.safeParse(req.body);
    if (!parsed.success) {
      // Format details for the fail response
      const details = parsed.error.issues;
      return fail(res, 'VALIDATION_ERROR', 'Validation failed', 400, details);
    }

    // req.tenantId might be set by some multitenancy middleware,
    // otherwise it might be in req.user.tenantId from auth middleware
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    const userId = req.user && req.user.userId;

    if (!tenantId) {
      return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);
    }

    const lead = await createLead({
      tenantId,
      userId,
      data: parsed.data
    });

    return success(res, lead, {}, 201);
  } catch (error) {
    if (error.message.includes('VALIDATION_ERROR') || error.message === 'INVALID_STAGE') {
      return fail(res, 'VALIDATION_ERROR', error.message, 400);
    }
    next(error);
  }
});

router.get('/', authenticate, authorize('leads:read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) {
      return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);
    }

    const { stageId, assigneeId, source, search, page, limit } = req.query;

    const result = await findLeads(tenantId, {
      stageId,
      assigneeId,
      source,
      search,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20
    });

    return paginate(res, result.data, result.total, result.page, result.limit);
  } catch (error) {
    next(error);
  }
});

router.get('/:id', authenticate, authorize('leads:read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) {
      return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);
    }

    const leadId = req.params.id;

    // 1. findLeadById
    const lead = await findLeadById(tenantId, leadId);

    // 2. If null -> 404
    if (!lead) {
      return fail(res, 'NOT_FOUND', 'Lead not found', 404);
    }

    // 3. listActivities -> recent activities
    const activitiesResult = await listActivities({
      tenantId,
      leadId,
      limit: 5
    });

    // 4. Return success
    return success(res, {
      ...lead,
      activities: activitiesResult.data
    });
  } catch (error) {
    next(error);
  }
});

router.patch('/:id', authenticate, authorize('leads:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) {
      return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);
    }

    const leadId = req.params.id;
    const userId = req.user && req.user.userId;

    const updatedLead = await updateLead({
      tenantId,
      userId,
      leadId,
      data: req.body
    });

    return success(res, updatedLead);
  } catch (error) {
    if (error.code === 'STAGE_GATE_FAILED') {
      return res.status(400).json({
        success: false,
        error: {
          code: 'STAGE_GATE_FAILED',
          message: 'Missing mandatory fields for this stage',
          missing: error.missing
        },
        timestamp: new Date().toISOString()
      });
    }
    if (error.message === 'NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Lead not found', 404);
    }
    if (error.message === 'INVALID_STAGE') {
      return fail(res, 'VALIDATION_ERROR', 'Invalid stage', 400);
    }
    next(error);
  }
});

router.delete('/:id', authenticate, authorize('leads:delete'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) {
      return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);
    }

    const leadId = req.params.id;
    const userId = req.user && req.user.userId;

    await deleteLead({
      tenantId,
      userId,
      leadId
    });

    return res.status(204).send();
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Lead not found', 404);
    }
    next(error);
  }
});

router.post('/:id/stage', authenticate, authorize('leads:update'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) {
      return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);
    }

    const leadId = req.params.id;
    const userId = req.user && req.user.userId;
    const { stageId } = req.body;

    if (!stageId) {
      return fail(res, 'VALIDATION_ERROR', 'stageId is required', 400);
    }

    const updatedLead = await changeStage({
      tenantId,
      userId,
      leadId,
      newStageId: stageId
    });

    return success(res, updatedLead);
  } catch (error) {
    if (error.code === 'STAGE_GATE_FAILED') {
      return res.status(422).json({
        success: false,
        error: {
          code: 'STAGE_GATE_FAILED',
          message: 'Missing mandatory fields for this stage',
          missing: error.missing
        },
        timestamp: new Date().toISOString()
      });
    }
    if (error.message === 'NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Lead not found', 404);
    }
    if (error.message === 'INVALID_STAGE') {
      return fail(res, 'VALIDATION_ERROR', 'Invalid stage', 400);
    }
    next(error);
  }
});

router.post('/:id/activities', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) {
      return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);
    }

    const leadId = req.params.id;
    const userId = req.user && req.user.userId;

    const parsed = logActivitySchema.safeParse(req.body);
    if (!parsed.success) {
      return fail(res, 'VALIDATION_ERROR', 'Validation failed', 400, parsed.error.issues);
    }

    const activity = await logActivity({
      tenantId,
      userId,
      leadId,
      ...parsed.data
    });

    return success(res, activity, {}, 201);
  } catch (error) {
    if (error.message.includes('INVALID_ACTIVITY_TYPE')) {
      return fail(res, 'VALIDATION_ERROR', error.message, 400);
    }
    next(error);
  }
});

router.get('/:id/activities', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) {
      return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);
    }

    const leadId = req.params.id;
    const { type, page, limit } = req.query;

    const result = await listActivities({
      tenantId,
      leadId,
      type,
      page: page ? parseInt(page, 10) : 1,
      limit: limit ? parseInt(limit, 10) : 20
    });

    return paginate(res, result.data, result.total, result.page, result.limit);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
