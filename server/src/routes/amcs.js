const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const amcService = require('../services/postSale/amcService');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createAmcSchema = z.object({
  contractNumber: z.string().min(1, 'Contract number is required'),
  contractValue: z.number().nonnegative('Contract value must be non-negative').optional(),
  startDate: z.string().regex(dateRegex, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(dateRegex, 'End date must be in YYYY-MM-DD format'),
  coveredScope: z.string().optional().nullable(),
  autoRenewalAlertDays: z.number().int().nonnegative().optional(),
  generateVisits: z.boolean().optional(),
  visitFrequency: z.enum(['monthly', 'quarterly', 'bi-annual', 'annual']).optional(),
  coveredProducts: z.any().optional(),
  exclusions: z.string().optional().nullable(),
  renewalDate: z.string().regex(dateRegex, 'Renewal date must be in YYYY-MM-DD format').optional().nullable(),
  paymentSchedule: z.string().optional().nullable()
});

const updateAmcSchema = z.object({
  contractNumber: z.string().min(1).optional(),
  contractValue: z.number().nonnegative().optional(),
  startDate: z.string().regex(dateRegex).optional(),
  endDate: z.string().regex(dateRegex).optional(),
  coveredScope: z.string().optional().nullable(),
  status: z.enum(['active', 'expired', 'renewed', 'cancelled']).optional(),
  autoRenewalAlertDays: z.number().int().nonnegative().optional(),
  renewalAlertSent: z.boolean().optional(),
  visitFrequency: z.enum(['monthly', 'quarterly', 'bi-annual', 'annual']).optional(),
  coveredProducts: z.any().optional(),
  exclusions: z.string().optional().nullable(),
  renewalDate: z.string().regex(dateRegex, 'Renewal date must be in YYYY-MM-DD format').optional().nullable(),
  paymentSchedule: z.string().optional().nullable()
});

const createVisitSchema = z.object({
  scheduledDate: z.string().regex(dateRegex, 'Scheduled date must be in YYYY-MM-DD format'),
  technicianId: z.string().uuid().optional().nullable(),
  remarks: z.string().optional().nullable()
});

const updateVisitSchema = z.object({
  scheduledDate: z.string().regex(dateRegex).optional(),
  status: z.enum(['scheduled', 'completed', 'missed', 'cancelled']).optional(),
  completedDate: z.string().regex(dateRegex).optional().nullable(),
  technicianId: z.string().uuid().optional().nullable(),
  remarks: z.string().optional().nullable()
});

// GET /api/projects/:projectId/amcs
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const amcs = await amcService.getAmcsByProject(projectId, tenantId);
    return success(res, amcs);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/amcs
router.post('/', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const data = createAmcSchema.parse(req.body);
    const amc = await amcService.createAmc({
      tenantId,
      projectId,
      contractNumber: data.contractNumber,
      contractValue: data.contractValue,
      startDate: data.startDate,
      endDate: data.endDate,
      coveredScope: data.coveredScope,
      autoRenewalAlertDays: data.autoRenewalAlertDays,
      generateVisits: data.generateVisits,
      visitFrequency: data.visitFrequency,
      coveredProducts: data.coveredProducts,
      exclusions: data.exclusions,
      renewalDate: data.renewalDate,
      paymentSchedule: data.paymentSchedule,
      userId
    });

    return success(res, amc, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    next(err);
  }
});

// PUT /api/projects/:projectId/amcs/:id
router.put('/:id', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const data = updateAmcSchema.parse(req.body);

    const updateData = {};
    if (data.contractNumber !== undefined) updateData.contract_number = data.contractNumber;
    if (data.contractValue !== undefined) updateData.contract_value = data.contractValue;
    if (data.startDate !== undefined) updateData.start_date = data.startDate;
    if (data.endDate !== undefined) updateData.end_date = data.endDate;
    if (data.coveredScope !== undefined) updateData.covered_scope = data.coveredScope;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.autoRenewalAlertDays !== undefined) updateData.auto_renewal_alert_days = data.autoRenewalAlertDays;
    if (data.renewalAlertSent !== undefined) updateData.renewal_alert_sent = data.renewalAlertSent;
    if (data.visitFrequency !== undefined) updateData.visit_frequency = data.visitFrequency;
    if (data.coveredProducts !== undefined) updateData.covered_products = data.coveredProducts ? JSON.stringify(data.coveredProducts) : null;
    if (data.exclusions !== undefined) updateData.exclusions = data.exclusions;
    if (data.renewalDate !== undefined) updateData.renewal_date = data.renewalDate;
    if (data.paymentSchedule !== undefined) updateData.payment_schedule = data.paymentSchedule;

    const amc = await amcService.updateAmc(id, tenantId, updateData, userId);
    return success(res, amc);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    if (err.message === 'AMC_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'AMC contract not found.', 404);
    }
    next(err);
  }
});

// DELETE /api/projects/:projectId/amcs/:id
router.delete('/:id', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const amc = await amcService.deleteAmc(id, tenantId, userId);
    return success(res, amc);
  } catch (err) {
    if (err.message === 'AMC_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'AMC contract not found.', 404);
    }
    next(err);
  }
});

// POST /api/projects/:projectId/amcs/:amcId/visits
router.post('/:amcId/visits', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { amcId } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const data = createVisitSchema.parse(req.body);
    const visit = await amcService.scheduleAmcVisit({
      tenantId,
      amcId,
      scheduledDate: data.scheduledDate,
      technicianId: data.technicianId,
      remarks: data.remarks,
      userId
    });

    return success(res, visit, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    if (err.message === 'AMC_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'AMC contract not found.', 404);
    }
    next(err);
  }
});

// PUT /api/projects/:projectId/amcs/:amcId/visits/:visitId
router.put('/:amcId/visits/:visitId', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { amcId, visitId } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const data = updateVisitSchema.parse(req.body);

    const updateData = {};
    if (data.scheduledDate !== undefined) updateData.scheduled_date = data.scheduledDate;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.completedDate !== undefined) updateData.completed_date = data.completedDate;
    if (data.technicianId !== undefined) updateData.technician_id = data.technicianId;
    if (data.remarks !== undefined) updateData.remarks = data.remarks;

    const visit = await amcService.updateAmcVisit(visitId, amcId, tenantId, updateData, userId);
    return success(res, visit);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    if (err.message === 'AMC_VISIT_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'AMC visit schedule not found.', 404);
    }
    next(err);
  }
});

// DELETE /api/projects/:projectId/amcs/:amcId/visits/:visitId
router.delete('/:amcId/visits/:visitId', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { amcId, visitId } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const visit = await amcService.deleteAmcVisit(visitId, amcId, tenantId, userId);
    return success(res, visit);
  } catch (err) {
    if (err.message === 'AMC_VISIT_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'AMC visit schedule not found.', 404);
    }
    next(err);
  }
});

module.exports = router;
