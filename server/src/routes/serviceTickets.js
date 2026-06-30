const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const serviceTicketService = require('../services/postSale/serviceTicketService');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const createTicketSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  category: z.string().min(1, 'Category is required'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  warrantyEligibility: z.enum(['eligible', 'not_eligible', 'checking', 'chargeable']).optional(),
  assignedEngineerId: z.string().uuid().optional().nullable(),
});

const updateTicketSchema = z.object({
  title: z.string().optional(),
  description: z.string().optional().nullable(),
  category: z.string().optional(),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional(),
  status: z.enum(['open', 'assigned', 'scheduled', 'resolved', 'closed']).optional(),
  warrantyEligibility: z.enum(['eligible', 'not_eligible', 'checking', 'chargeable']).optional(),
  assignedEngineerId: z.string().uuid().optional().nullable(),
  resolutionDetails: z.string().optional().nullable(),
  resolvedAt: z.string().optional().nullable(),
});

const createVisitSchema = z.object({
  scheduledDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: 'Invalid scheduled date format' }),
  engineerId: z.string().uuid().optional().nullable(),
  visitSummary: z.string().optional().nullable(),
});

const updateVisitSchema = z.object({
  scheduledDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: 'Invalid scheduled date format' }).optional(),
  status: z.enum(['scheduled', 'completed', 'cancelled']).optional(),
  completedDate: z.string().refine(val => !isNaN(Date.parse(val)), { message: 'Invalid completed date format' }).optional().nullable(),
  engineerId: z.string().uuid().optional().nullable(),
  visitSummary: z.string().optional().nullable(),
  clientConfirmed: z.boolean().optional(),
  clientConfirmedAt: z.string().refine(val => !isNaN(Date.parse(val)), { message: 'Invalid date format' }).optional().nullable(),
  reminderSent: z.boolean().optional(),
  visitOutcome: z.string().optional().nullable(),
});

// GET /api/projects/:projectId/service-tickets
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const tickets = await serviceTicketService.getTicketsByProject(projectId, tenantId);
    return success(res, tickets);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/service-tickets
router.post('/', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const data = createTicketSchema.parse(req.body);
    const ticket = await serviceTicketService.createTicket({
      tenantId,
      projectId,
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority,
      warrantyEligibility: data.warrantyEligibility,
      assignedEngineerId: data.assignedEngineerId,
      userId
    });

    return success(res, ticket, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    next(err);
  }
});

// GET /api/projects/:projectId/service-tickets/csat-metrics
router.get('/csat-metrics', authorize('projects:read'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId;
    const metrics = await serviceTicketService.getCsatMetrics(tenantId);
    return success(res, metrics);
  } catch (err) {
    next(err);
  }
});

// GET /api/projects/:projectId/service-tickets/:id
router.get('/:id', authorize('projects:read'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const ticket = await serviceTicketService.getTicketById(id, tenantId);
    if (!ticket) {
      return fail(res, 'NOT_FOUND', 'Service ticket not found.', 404);
    }
    return success(res, ticket);
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:projectId/service-tickets/:id
router.put('/:id', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const data = updateTicketSchema.parse(req.body);

    const updateData = {};
    if (data.title !== undefined) updateData.title = data.title;
    if (data.description !== undefined) updateData.description = data.description;
    if (data.category !== undefined) updateData.category = data.category;
    if (data.priority !== undefined) updateData.priority = data.priority;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.warrantyEligibility !== undefined) updateData.warranty_eligibility = data.warrantyEligibility;
    if (data.assignedEngineerId !== undefined) updateData.assigned_engineer_id = data.assignedEngineerId;
    if (data.resolutionDetails !== undefined) updateData.resolution_details = data.resolutionDetails;
    if (data.resolvedAt !== undefined) updateData.resolved_at = data.resolvedAt;

    const ticket = await serviceTicketService.updateTicket(id, tenantId, updateData, userId);
    return success(res, ticket);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    if (err.message === 'TICKET_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Service ticket not found.', 404);
    }
    next(err);
  }
});

// DELETE /api/projects/:projectId/service-tickets/:id
router.delete('/:id', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const ticket = await serviceTicketService.deleteTicket(id, tenantId, userId);
    return success(res, ticket);
  } catch (err) {
    if (err.message === 'TICKET_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Service ticket not found.', 404);
    }
    next(err);
  }
});

// POST /api/projects/:projectId/service-tickets/:id/visits
router.post('/:id/visits', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const data = createVisitSchema.parse(req.body);
    const visit = await serviceTicketService.scheduleVisit({
      tenantId,
      ticketId: id,
      scheduledDate: data.scheduledDate,
      engineerId: data.engineerId,
      visitSummary: data.visitSummary,
      userId
    });

    return success(res, visit, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    if (err.message === 'TICKET_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Service ticket not found.', 404);
    }
    next(err);
  }
});

// PUT /api/projects/:projectId/service-tickets/:id/visits/:visitId
router.put('/:id/visits/:visitId', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { id, visitId } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const data = updateVisitSchema.parse(req.body);

    const updateData = {};
    if (data.scheduledDate !== undefined) updateData.scheduled_date = data.scheduledDate;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.completedDate !== undefined) updateData.completed_date = data.completedDate;
    if (data.engineerId !== undefined) updateData.engineer_id = data.engineerId;
    if (data.visitSummary !== undefined) updateData.visit_summary = data.visitSummary;
    if (data.clientConfirmed !== undefined) updateData.client_confirmed = data.clientConfirmed;
    if (data.clientConfirmedAt !== undefined) updateData.client_confirmed_at = data.clientConfirmedAt;
    if (data.reminderSent !== undefined) updateData.reminder_sent = data.reminderSent;
    if (data.visitOutcome !== undefined) updateData.visit_outcome = data.visitOutcome;

    const visit = await serviceTicketService.updateVisit(visitId, id, tenantId, updateData, userId);
    return success(res, visit);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    if (err.message === 'VISIT_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Service visit not found.', 404);
    }
    next(err);
  }
});

// DELETE /api/projects/:projectId/service-tickets/:id/visits/:visitId
router.delete('/:id/visits/:visitId', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { id, visitId } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const visit = await serviceTicketService.deleteVisit(visitId, id, tenantId, userId);
    return success(res, visit);
  } catch (err) {
    if (err.message === 'VISIT_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Service visit not found.', 404);
    }
    next(err);
  }
});

const addPartSchema = z.object({
  partName: z.string().min(1, 'Part name is required'),
  quantity: z.number().int().min(1).default(1),
  cost: z.number().optional().nullable(),
  visitId: z.string().uuid().optional().nullable()
});

// POST /api/projects/:projectId/service-tickets/:id/parts
router.post('/:id/parts', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const data = addPartSchema.parse(req.body);
    const part = await serviceTicketService.addPartUsed({
      tenantId,
      ticketId: id,
      visitId: data.visitId,
      partName: data.partName,
      quantity: data.quantity,
      cost: data.cost,
      userId
    });

    return success(res, part, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    if (err.message === 'TICKET_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Service ticket not found.', 404);
    }
    next(err);
  }
});

// DELETE /api/projects/:projectId/service-tickets/:id/parts/:partId
router.delete('/:id/parts/:partId', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { id, partId } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const part = await serviceTicketService.removePartUsed(partId, id, tenantId, userId);
    return success(res, part);
  } catch (err) {
    if (err.message === 'PART_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Part not found.', 404);
    }
    next(err);
  }
});

module.exports = router;
