const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const milestoneRepository = require('../repositories/milestoneRepository');
const pool = require('../config/db');

// mergeParams: true allows extraction of :phaseId from the app.use mounting point
const router = express.Router({ mergeParams: true });
router.use(authenticate);

const createMilestoneSchema = z.object({
  name: z.string().min(1, 'Name is required'),
  description: z.string().optional(),
  due_date: z.string().optional().nullable(),
  triggers_payment: z.boolean().optional(),
  sort_order: z.number().optional()
});

const updateMilestoneSchema = createMilestoneSchema.partial().extend({
  status: z.string().optional()
});

// GET /api/phases/:phaseId/milestones
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const milestones = await milestoneRepository.findMilestonesByPhase(req.params.phaseId, req.tenantId);
    return success(res, milestones);
  } catch (err) {
    console.error('[Milestones Router] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch milestones.', 500);
  }
});

// POST /api/phases/:phaseId/milestones
router.post('/', authorize('projects:manage'), async (req, res, next) => {
  try {
    const data = createMilestoneSchema.parse(req.body);
    
    // Verify parent phase existence & extract linked project_id
    const { rows } = await pool.query(
      'SELECT project_id FROM project_phases WHERE id = $1 AND tenant_id = $2',
      [req.params.phaseId, req.tenantId]
    );

    if (rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Phase not found.', 404);
    }
    
    const projectId = rows[0].project_id;
    const milestone = await milestoneRepository.createMilestone(req.tenantId, req.params.phaseId, projectId, data);
    
    return success(res, milestone, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[Milestones Router] Create error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create milestone.', 500);
  }
});

// PATCH /api/phases/:phaseId/milestones/:mid
router.patch('/:mid', authorize('projects:manage'), async (req, res, next) => {
  try {
    const data = updateMilestoneSchema.parse(req.body);
    const updated = await milestoneRepository.updateMilestone(req.params.mid, req.tenantId, data);
    return success(res, updated);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    if (err.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Milestone not found.', 404);
    console.error('[Milestones Router] Update error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update milestone.', 500);
  }
});

// DELETE /api/phases/:phaseId/milestones/:mid
router.delete('/:mid', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { rowCount } = await pool.query(
      'DELETE FROM milestones WHERE id = $1 AND tenant_id = $2 AND phase_id = $3',
      [req.params.mid, req.tenantId, req.params.phaseId]
    );
    if (rowCount === 0) return fail(res, 'NOT_FOUND', 'Milestone not found.', 404);
    return res.status(204).send();
  } catch (err) {
    console.error('[Milestones Router] Delete error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete milestone.', 500);
  }
});

// POST /api/phases/:phaseId/milestones/:mid/complete
router.post('/:mid/complete', authorize('projects:manage'), async (req, res, next) => {
  try {
    const updated = await milestoneRepository.completeMilestone(req.params.mid, req.user.userId, req.tenantId);
    
    return success(res, { 
      milestone: updated,
      paymentTriggered: updated.triggers_payment
    });
  } catch (err) {
    if (err.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Milestone not found.', 404);
    console.error('[Milestones Router] Complete error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to complete milestone.', 500);
  }
});

module.exports = router;
