const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../../utils/response');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const workActivityRepository = require('../../repositories/workActivityRepository');

const router = express.Router();
router.use(authenticate, authorize('config:manage'));

const createTemplateSchema = z.object({
  trade: z.string().min(1, 'Trade is required'),
  room_type: z.string().optional().default('General'),
  activity_name: z.string().min(1, 'Activity name is required'),
  description: z.string().optional().nullable(),
  sort_order: z.number().int().optional().default(0)
});

const updateTemplateSchema = z.object({
  trade: z.string().optional(),
  room_type: z.string().optional(),
  activity_name: z.string().optional(),
  description: z.string().optional().nullable(),
  sort_order: z.number().int().optional()
});

// GET /api/config/trade-activity-templates
router.get('/', async (req, res, next) => {
  try {
    const { trade, roomType } = req.query;
    const templates = await workActivityRepository.findTemplates(trade, roomType, req.tenantId);
    return success(res, templates);
  } catch (error) {
    next(error);
  }
});

// POST /api/config/trade-activity-templates
router.post('/', async (req, res, next) => {
  try {
    const parsed = createTemplateSchema.parse(req.body);
    const template = await workActivityRepository.createTemplate(req.tenantId, parsed);
    return success(res, template, {}, 201);
  } catch (error) {
    if (error instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', error.errors, 400);
    next(error);
  }
});

// PATCH /api/config/trade-activity-templates/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const parsed = updateTemplateSchema.parse(req.body);
    const template = await workActivityRepository.updateTemplate(req.params.id, req.tenantId, parsed);
    return success(res, template);
  } catch (error) {
    if (error instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', error.errors, 400);
    if (error.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Template not found', 404);
    next(error);
  }
});

// DELETE /api/config/trade-activity-templates/:id
router.delete('/:id', async (req, res, next) => {
  try {
    await workActivityRepository.deleteTemplate(req.params.id, req.tenantId);
    return res.status(204).send();
  } catch (error) {
    if (error.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Template not found', 404);
    next(error);
  }
});

module.exports = router;
