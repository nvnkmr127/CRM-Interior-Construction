const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authorize = require('../middleware/authorize');
const { getOrCreateClosureChecklist, updateClosureChecklist } = require('../services/postSale/projectClosureService');

const router = express.Router({ mergeParams: true });

const updateClosureChecklistSchema = z.object({
  financial_clearance_completed: z.boolean().optional(),
  financial_clearance_notes: z.string().optional().nullable(),
  task_completion_completed: z.boolean().optional(),
  task_completion_notes: z.string().optional().nullable(),
  snag_closure_completed: z.boolean().optional(),
  snag_closure_notes: z.string().optional().nullable(),
  document_archive_completed: z.boolean().optional(),
  document_archive_notes: z.string().optional().nullable(),
  warranty_activation_completed: z.boolean().optional(),
  warranty_activation_notes: z.string().optional().nullable(),
});

// GET /api/projects/:projectId/closure-checklist
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;

    const result = await getOrCreateClosureChecklist(projectId, tenantId);
    return success(res, result);
  } catch (err) {
    if (err.message === 'PROJECT_NOT_FOUND' || err.status === 404) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    next(err);
  }
});

// PATCH /api/projects/:projectId/closure-checklist
router.patch('/', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const data = updateClosureChecklistSchema.parse(req.body);
    const result = await updateClosureChecklist(projectId, tenantId, userId, data);
    return success(res, result);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    if (err.message === 'PROJECT_NOT_FOUND' || err.status === 404) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    next(err);
  }
});

module.exports = router;
