const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { getRetrospective, saveRetrospective } = require('../services/postSale/projectRetrospectiveService');

const router = express.Router({ mergeParams: true });

const saveRetrospectiveSchema = z.object({
  what_went_well: z.string().optional().nullable(),
  what_went_wrong: z.string().optional().nullable(),
  design_feedback: z.string().optional().nullable(),
  process_changes: z.string().optional().nullable(),
  vendor_ratings: z.array(z.object({
    project_vendor_id: z.string().uuid(),
    rating: z.number().int().min(1).max(5),
    feedback: z.string().optional().nullable()
  })).optional()
});

// GET /api/projects/:projectId/retrospective
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;

    const result = await getRetrospective(projectId, tenantId);
    return success(res, result);
  } catch (err) {
    if (err.message === 'PROJECT_NOT_FOUND' || err.status === 404) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    next(err);
  }
});

// POST /api/projects/:projectId/retrospective
router.post('/', authorize('projects:manage'), validate(saveRetrospectiveSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const data  = req.body;
    const result = await saveRetrospective(projectId, tenantId, userId, data);
    return success(res, result, { message: 'Retrospective saved successfully.' });
  } catch (err) {
    
    if (err.message === 'PROJECT_NOT_FOUND' || err.status === 404) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    if (err.message === 'INVALID_RATING') {
      return fail(res, 'BAD_REQUEST', 'Rating must be an integer between 1 and 5', 400);
    }
    next(err);
  }
});

module.exports = router;
