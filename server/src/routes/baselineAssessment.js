const express = require('express');
const { z } = require('zod');
const { success } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
const authorize = require('../middleware/authorize');
const baselineAssessmentRepository = require('../repositories/baselineAssessmentRepository');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const saveAssessmentSchema = z.object({
  overall_notes: z.string().optional().nullable(),
  video_walkthrough_url: z.string().optional().nullable(),
  items: z.array(
    z.object({
      room_name: z.string(),
      area_checked: z.string(),
      condition_status: z.string().optional(),
      notes: z.string().optional().nullable(),
      photos: z.array(z.string()).optional()
    })
  ).optional()
});

// GET /api/projects/:projectId/baseline-assessment
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const assessment = await baselineAssessmentRepository.findAssessment(
      req.tenantId,
      req.params.projectId
    );
    return success(res, assessment);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/baseline-assessment
router.post('/', authorize('projects:manage'), validate(saveAssessmentSchema), async (req, res, next) => {
  try {
    const body  = req.body;
    const assessment = await baselineAssessmentRepository.saveAssessment(
      req.tenantId,
      req.params.projectId,
      req.user?.userId,
      body
    );
    return success(res, assessment);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
