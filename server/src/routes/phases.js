const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authorize = require('../middleware/authorize');
const phaseRepository = require('../repositories/phaseRepository');
const { completePhase, checkScopeLock } = require('../services/projects/completePhase');

// mergeParams: true allows access to :projectId from parent projectsRouter
const router = express.Router({ mergeParams: true });

const createPhaseSchema = z.object({
  name: z.string().min(1, 'Phase name is required'),
  sort_order: z.number().optional(),
  duration_days: z.number().optional().nullable(),
  sign_off_required: z.boolean().optional(),
  sign_off_by: z.string().optional()
});

const updatePhaseSchema = z.object({
  name: z.string().optional(),
  sort_order: z.number().optional(),
  duration_days: z.number().optional().nullable(),
  status: z.string().optional()
});

const reorderSchema = z.object({
  orderedIds: z.array(z.string().uuid())
});

// GET /api/projects/:projectId/phases
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const phases = await phaseRepository.findPhasesByProject(req.tenantId, req.params.projectId);
    return success(res, phases);
  } catch (err) {
    console.error('[Phases Router] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to retrieve phases.', 500);
  }
});

// POST /api/projects/:projectId/phases
router.post('/', authorize('projects:manage'), async (req, res, next) => {
  try {
    const data = createPhaseSchema.parse(req.body);
    const phase = await phaseRepository.createPhase(req.tenantId, req.params.projectId, data);
    return success(res, phase, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[Phases Router] Create error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create phase.', 500);
  }
});

// PATCH /api/projects/:projectId/phases/reorder
router.patch('/reorder', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { orderedIds } = reorderSchema.parse(req.body);
    await phaseRepository.reorderPhases(req.params.projectId, req.tenantId, orderedIds);
    return success(res, { message: 'Phases reordered successfully' });
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[Phases Router] Reorder error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to reorder phases.', 500);
  }
});

// PUT /api/projects/:projectId/phases/:phaseId
router.put('/:phaseId', authorize('projects:manage'), async (req, res, next) => {
  try {
    const data = updatePhaseSchema.parse(req.body);
    if (data.status && (data.status === 'in_progress' || data.status === 'active')) {
      await checkScopeLock(req.tenantId, req.params.projectId, req.params.phaseId);
    }
    const phase = await phaseRepository.updatePhase(req.params.phaseId, req.tenantId, data);
    return success(res, phase);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    if (err.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Phase not found', 404);
    if (
      err.status === 400 ||
      err.message === 'SCOPE_LOCK_REQUIRED' ||
      err.message === 'SITE_READINESS_REQUIRED' ||
      err.message.includes('Design scope must be locked') ||
      err.message.includes('Site readiness checklist')
    ) {
      return fail(res, err.status === 400 ? 'SITE_READINESS_REQUIRED' : 'SCOPE_LOCK_REQUIRED', err.message, 400);
    }
    console.error('[Phases Router] Update error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update phase.', 500);
  }
});

// DELETE /api/projects/:projectId/phases/:phaseId
router.delete('/:phaseId', authorize('projects:manage'), async (req, res, next) => {
  try {
    await phaseRepository.deletePhase(req.params.phaseId, req.tenantId);
    return res.status(204).send();
  } catch (err) {
    if (err.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Phase not found', 404);
    console.error('[Phases Router] Delete error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete phase.', 500);
  }
});

// POST /api/projects/:projectId/phases/:phaseId/sign-off
router.post('/:phaseId/sign-off', authorize('projects:manage'), async (req, res, next) => {
  try {
    const result = await completePhase({
      tenantId: req.tenantId,
      userId: req.user.userId,
      phaseId: req.params.phaseId
    });
    return success(res, result);
  } catch (err) {
    if (err.message === 'MILESTONES_INCOMPLETE') {
      return fail(res, 'MILESTONES_INCOMPLETE', err.details, 422);
    }
    if (err.message === 'SITE_READINESS_REQUIRED' || err.message.includes('Site readiness checklist')) {
      return fail(res, 'SITE_READINESS_REQUIRED', err.message, 400);
    }
    if (err.message === 'SCOPE_LOCK_REQUIRED' || err.message.includes('Design scope must be locked')) {
      return fail(res, 'SCOPE_LOCK_REQUIRED', err.message, 400);
    }
    if (err.message === 'PHASE_ALREADY_COMPLETED') {
      return fail(res, 'PHASE_ALREADY_COMPLETED', 'Phase is already completed', 400);
    }
    if (err.status === 400) {
      return fail(res, err.code || 'BAD_REQUEST', err.message, 400);
    }
    if (err.message === 'NOT_FOUND' || err.status === 404) {
      return fail(res, 'NOT_FOUND', 'Phase not found', 404);
    }
    console.error('[Phases Router] Sign-off error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to sign-off phase.', 500);
  }
});

module.exports = router;
