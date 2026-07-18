const express = require('express');
const { z } = require('zod');
const authenticatePortal = require('../../middleware/authenticatePortal');
const validate = require('../../middleware/validate');
const { success, fail } = require('../../utils/response');
const serviceTicketService = require('../../services/postSale/serviceTicketService');

const router = express.Router();
router.use(authenticatePortal);

const createPortalTicketSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  description: z.string().optional().nullable(),
  category: z.string().min(1, 'Category is required'),
  priority: z.enum(['low', 'medium', 'high', 'critical']).optional()
});

const feedbackSchema = z.object({
  rating: z.number().int().min(1).max(5, 'Rating must be between 1 and 5'),
  comments: z.string().optional().nullable()
});

// GET /api/portal/service-tickets
router.get('/', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const tickets = await serviceTicketService.getTicketsByProject(projectId, tenantId);
    return success(res, tickets);
  } catch (err) {
    next(err);
  }
});

// POST /api/portal/service-tickets
router.post('/', validate(createPortalTicketSchema), async (req, res, next) => {
  try {
    const { projectId, tenantId, id: portalUserId } = req.portalUser;

    const data = req.body;
    const ticket = await serviceTicketService.createTicket({
      tenantId,
      projectId,
      clientPortalUserId: portalUserId,
      title: data.title,
      description: data.description,
      category: data.category,
      priority: data.priority || 'medium',
      warrantyEligibility: 'checking'
    });

    return success(res, ticket, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    next(err);
  }
});

// GET /api/portal/service-tickets/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tenantId, projectId } = req.portalUser;

    const ticket = await serviceTicketService.getTicketById(id, tenantId);
    if (!ticket) {
      return fail(res, 'NOT_FOUND', 'Service ticket not found.', 404);
    }

    // Security check: ensure ticket belongs to client's project
    if (ticket.project_id !== projectId) {
      return fail(res, 'FORBIDDEN', 'Access denied to this service ticket.', 403);
    }

    return success(res, ticket);
  } catch (err) {
    next(err);
  }
});

// POST /api/portal/service-tickets/:id/feedback
router.post('/:id/feedback', validate(feedbackSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { tenantId, id: portalUserId } = req.portalUser;

    const data = req.body;

    try {
      const ticket = await serviceTicketService.submitClientFeedback(
        id,
        tenantId,
        { rating: data.rating, comments: data.comments },
        portalUserId
      );
      return success(res, ticket);
    } catch (err) {
      if (err.message === 'TICKET_NOT_FOUND') {
        return fail(res, 'NOT_FOUND', 'Service ticket not found.', 404);
      }
      if (err.message === 'INVALID_TICKET_STATUS_FOR_FEEDBACK') {
        return fail(res, 'BAD_REQUEST', 'Feedback can only be submitted for resolved or closed tickets.', 400);
      }
      throw err;
    }
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    next(err);
  }
});

// POST /api/portal/service-tickets/:id/visits/:visitId/confirm
router.post('/:id/visits/:visitId/confirm', async (req, res, next) => {
  try {
    const { id, visitId } = req.params;
    const { tenantId, projectId, id: portalUserId } = req.portalUser;

    // Security check: ensure ticket belongs to client's project
    const ticket = await serviceTicketService.getTicketById(id, tenantId);
    if (!ticket) {
      return fail(res, 'NOT_FOUND', 'Service ticket not found.', 404);
    }
    if (ticket.project_id !== projectId) {
      return fail(res, 'FORBIDDEN', 'Access denied to this service ticket.', 403);
    }

    try {
      const visit = await serviceTicketService.confirmVisit(visitId, id, tenantId, portalUserId);
      return success(res, visit);
    } catch (err) {
      if (err.message === 'VISIT_NOT_FOUND') {
        return fail(res, 'NOT_FOUND', 'Service visit not found.', 404);
      }
      throw err;
    }
  } catch (err) {
    next(err);
  }
});

const csatSchema = z.object({
  referenceType: z.enum(['handover', 'service_visit']),
  referenceId: z.string().uuid(),
  score: z.number().int().min(1).max(5),
  comments: z.string().optional().nullable()
});

router.post('/csat', validate(csatSchema), async (req, res, next) => {
  try {
    const { projectId, tenantId, id: portalUserId } = req.portalUser;
    const data = req.body;

    const csat = await serviceTicketService.submitCsat({
      tenantId,
      projectId,
      referenceType: data.referenceType,
      referenceId: data.referenceId,
      score: data.score,
      comments: data.comments,
      clientPortalUserId: portalUserId
    });

    return success(res, csat, {}, 201);
  } catch (err) {
    if (err.message === 'PROJECT_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Project not found.', 404);
    }
    next(err);
  }
});

module.exports = router;
