const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const siteReadinessRepository = require('../repositories/siteReadinessRepository');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const updateItemSchema = z.object({
  is_completed: z.boolean().optional(),
  notes: z.string().optional().nullable(),
  photo_key: z.string().optional().nullable()
});

// GET /api/projects/:projectId/site-readiness
router.get('/', authorize('projects:read'), async (req, res) => {
  try {
    const checklist = await siteReadinessRepository.findChecklist(req.tenantId, req.params.projectId);
    return success(res, checklist);
  } catch (err) {
    console.error('[SiteReadiness Router] Fetch error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch site readiness checklist.', 500);
  }
});

// PATCH /api/projects/:projectId/site-readiness/:itemId
router.patch('/:itemId', authorize('projects:manage'), async (req, res) => {
  try {
    const updates = updateItemSchema.parse(req.body);
    const item = await siteReadinessRepository.updateChecklistItem(
      req.params.itemId,
      req.tenantId,
      updates,
      req.user?.userId
    );
    return success(res, item);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    if (err.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Checklist item not found.', 404);
    console.error('[SiteReadiness Router] Update error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update checklist item.', 500);
  }
});

// POST /api/projects/:projectId/site-readiness/sign-off
router.post('/sign-off', authorize('projects:manage'), async (req, res) => {
  try {
    const checklist = await siteReadinessRepository.signOffAll(
      req.tenantId,
      req.params.projectId,
      req.user?.userId
    );
    return success(res, checklist);
  } catch (err) {
    console.error('[SiteReadiness Router] Sign off error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to sign off checklist.', 500);
  }
});

module.exports = router;
