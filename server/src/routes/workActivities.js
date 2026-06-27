const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const workActivityRepository = require('../repositories/workActivityRepository');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const createActivitySchema = z.object({
  phase_id: z.string().uuid().optional().nullable(),
  room_name: z.string().min(1, 'Room name is required'),
  trade: z.string().min(1, 'Trade is required'),
  activity_name: z.string().min(1, 'Activity name is required'),
  description: z.string().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().nullable(),
  status: z.string().optional(),
  notes: z.string().optional().nullable(),
  qc_checklist: z.array(z.object({
    id: z.string(),
    label: z.string(),
    required: z.boolean().optional(),
    is_checked: z.boolean().optional()
  })).optional()
});

const updateActivitySchema = z.object({
  phase_id: z.string().uuid().optional().nullable(),
  room_name: z.string().optional(),
  trade: z.string().optional(),
  activity_name: z.string().optional(),
  description: z.string().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  due_date: z.string().optional().nullable(),
  status: z.enum(['todo', 'in_progress', 'completed']).optional(),
  notes: z.string().optional().nullable(),
  qc_checklist: z.array(z.object({
    id: z.string(),
    label: z.string(),
    required: z.boolean().optional(),
    is_checked: z.boolean().optional()
  })).optional()
});

const generateSchema = z.object({
  phaseId: z.string().uuid().optional().nullable(),
  roomName: z.string().min(1, 'Room name is required'),
  trade: z.string().min(1, 'Trade is required')
});

// GET /api/projects/:projectId/work-activities
router.get('/', authorize('projects:read'), async (req, res) => {
  try {
    const { phaseId, trade, roomName, status } = req.query;
    const activities = await workActivityRepository.findActivities(req.tenantId, req.params.projectId, {
      phaseId,
      trade,
      roomName,
      status
    });
    return success(res, activities);
  } catch (err) {
    console.error('[WorkActivities Router] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch work activities.', 500);
  }
});

// GET /api/projects/:projectId/work-activities/templates
router.get('/templates', authorize('projects:read'), async (req, res) => {
  try {
    const { trade, roomType } = req.query;
    const templates = await workActivityRepository.findTemplates(trade, roomType);
    return success(res, templates);
  } catch (err) {
    console.error('[WorkActivities Router] Templates list error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch templates.', 500);
  }
});

// POST /api/projects/:projectId/work-activities
router.post('/', authorize('projects:manage'), async (req, res) => {
  try {
    const data = createActivitySchema.parse(req.body);
    data.project_id = req.params.projectId;

    const activity = await workActivityRepository.createActivity(req.tenantId, data);
    return success(res, activity, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[WorkActivities Router] Create error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create work activity.', 500);
  }
});

// POST /api/projects/:projectId/work-activities/generate
router.post('/generate', authorize('projects:manage'), async (req, res) => {
  try {
    const { phaseId, roomName, trade } = generateSchema.parse(req.body);
    const created = await workActivityRepository.generateActivities(
      req.tenantId,
      req.params.projectId,
      phaseId,
      roomName,
      trade
    );
    return success(res, created, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[WorkActivities Router] Generate error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to generate activities.', 500);
  }
});

// PATCH /api/projects/:projectId/work-activities/:id
router.patch('/:id', authorize('projects:manage'), async (req, res) => {
  try {
    const updates = updateActivitySchema.parse(req.body);
    const activity = await workActivityRepository.updateActivity(
      req.params.id,
      req.tenantId,
      updates,
      req.user?.userId
    );
    return success(res, activity);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    if (err.status === 400) return fail(res, err.code || 'BAD_REQUEST', err.message, 400);
    if (err.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Work activity not found.', 404);
    console.error('[WorkActivities Router] Update error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update work activity.', 500);
  }
});

// DELETE /api/projects/:projectId/work-activities/:id
router.delete('/:id', authorize('projects:manage'), async (req, res) => {
  try {
    await workActivityRepository.deleteActivity(req.params.id, req.tenantId);
    return success(res, { message: 'Work activity deleted successfully' });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Work activity not found.', 404);
    console.error('[WorkActivities Router] Delete error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete work activity.', 500);
  }
});

module.exports = router;
