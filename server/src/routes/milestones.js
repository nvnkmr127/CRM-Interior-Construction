const logger = require('../utils/logger');
const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const validate = require('../middleware/validate');
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
  status: z.string().optional(),
  completion_date: z.string().optional().nullable(),
  completed_by: z.string().optional().nullable()
});

// GET /api/phases/:phaseId/milestones
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const milestones = await milestoneRepository.findMilestonesByPhase(req.params.phaseId, req.tenantId);
    return success(res, milestones);
  } catch (error) {
    logger.error('[Milestones Router] List error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch milestones.', 500);
  }
});

// POST /api/phases/:phaseId/milestones
router.post('/', authorize('projects:manage'), validate(createMilestoneSchema), async (req, res, next) => {
  try {
    const data  = req.body;
    
    // Verify parent phase existence & extract linked project_id
    const { rows } = await pool.query(
      'SELECT project_id FROM project_phases WHERE id = $1 AND tenant_id = $2',
      [req.params.phaseId, req.tenantId]
    );

    if (rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Phase not found.', 404);
    }
    
    const projectId = rows[0].project_id;

    // Verify project is not pending booking
    const projRes = await pool.query(
      'SELECT status FROM projects WHERE id = $1 AND tenant_id = $2',
      [projectId, req.tenantId]
    );
    if (projRes.rows.length > 0 && projRes.rows[0].status === 'pending_booking') {
      return fail(res, 'BOOKING_REQUIRED', 'Project booking confirmation is pending. Downstream actions are locked.', 400);
    }

    const milestone = await milestoneRepository.createMilestone(req.tenantId, req.params.phaseId, projectId, data);
    
    return success(res, milestone, {}, 201);
  } catch (error) {
    
    logger.error('[Milestones Router] Create error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create milestone.', 500);
  }
});

// PATCH /api/phases/:phaseId/milestones/:mid
router.patch('/:mid', authorize('projects:manage'), validate(updateMilestoneSchema), async (req, res, next) => {
  try {
    const data  = req.body;
    const updated = await milestoneRepository.updateMilestone(req.params.mid, req.tenantId, data);
    return success(res, updated);
  } catch (error) {
    
    if (error.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Milestone not found.', 404);
    logger.error('[Milestones Router] Update error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update milestone.', 500);
  }
});

// DELETE /api/phases/:phaseId/milestones/:mid
router.delete('/:mid', authorize('projects:manage'), async (req, res, next) => {
  try {
    // 1. Delete tasks generated from phase/schedule for this milestone
    await pool.query(`
      DELETE FROM tasks
      WHERE milestone_id = $1 AND tenant_id = $2
        AND (
          custom_fields LIKE '%"source":"phase_schedule"%'
          OR (
            (custom_fields IS NULL OR custom_fields = '' OR custom_fields NOT LIKE '%"source":"manual"%')
            AND (custom_fields IS NULL OR custom_fields NOT LIKE '%"source":"payment"%')
            AND (custom_fields IS NULL OR custom_fields NOT LIKE '%"source":"snag"%')
          )
        )
    `, [req.params.mid, req.tenantId]);

    // 2. Unlink any manual tasks linked to this milestone
    await pool.query(`
      UPDATE tasks
      SET milestone_id = NULL
      WHERE milestone_id = $1 AND tenant_id = $2
    `, [req.params.mid, req.tenantId]);

    // 2b. Clean up linked scheduled payment milestone if no payments or approvals
    await pool.query(`
      DELETE FROM payment_milestones
      WHERE milestone_id = $1 AND tenant_id = $2 AND status = 'scheduled'
        AND id NOT IN (SELECT target_id::uuid FROM financial_approvals WHERE target_id IS NOT NULL AND tenant_id = $2)
    `, [req.params.mid, req.tenantId]).catch(() => {});

    // 3. Delete the milestone
    const { rowCount } = await pool.query(
      'DELETE FROM milestones WHERE id = $1 AND tenant_id = $2 AND phase_id = $3',
      [req.params.mid, req.tenantId, req.params.phaseId]
    );
    if (rowCount === 0) return fail(res, 'NOT_FOUND', 'Milestone not found.', 404);

    // Sync phase status if remaining milestones are all done
    const stats = await pool.query(`
      SELECT 
        COUNT(*)::int as total_milestones,
        COUNT(CASE WHEN status = 'completed' THEN 1 END)::int as completed_milestones
      FROM milestones
      WHERE phase_id = $1 AND tenant_id = $2
    `, [req.params.phaseId, req.tenantId]);

    if (stats.rows.length > 0 && stats.rows[0].total_milestones > 0) {
      const { total_milestones, completed_milestones } = stats.rows[0];
      if (completed_milestones === total_milestones) {
        await pool.query(`
          UPDATE project_phases
          SET status = 'completed'
          WHERE id = $1 AND tenant_id = $2
        `, [req.params.phaseId, req.tenantId]);
      }
    }

    const { clearCachePrefix } = require('../utils/cache');
    await clearCachePrefix('cache:').catch(() => {});
    await clearCachePrefix('/api/projects').catch(() => {});

    return res.status(204).send();
  } catch (error) {
    logger.error('[Milestones Router] Delete error:', error);
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
  } catch (error) {
    if (error.message === 'NOT_FOUND') return fail(res, 'NOT_FOUND', 'Milestone not found.', 404);
    logger.error('[Milestones Router] Complete error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to complete milestone.', 500);
  }
});

module.exports = router;
