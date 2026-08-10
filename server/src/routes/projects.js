const logger = require('../utils/logger');
const express = require('express');
const { z } = require('zod');
const {
  uploadUrlSchema,
  createProjectSchema,
  updateReferralSchema,
  cancelProjectSchema,
  updateRetentionSchema,
  reopenProjectSchema,
  scheduleAppointmentSchema,
  designRequirementsSchema,
  roomRequirementSchema,
  inspirationSchema,
  replaceResourceSchema,
  pauseProjectSchema,
  resumeProjectSchema,
  handoverSignOffSchema,
  updateComplianceSchema,
  updateMepChecklistSchema,
  updateVendorCoordinationSchema,
  vendorRecoverySchema,
  confirmBookingSchema,
  coordinationSchema,
  applySchema
} = require('../../../shared/validators/projectSchemas');
const { success, fail, paginate } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const validate = require('../middleware/validate');
const { applyTemplate } = require('../services/config/templateService');
const { createProject } = require('../services/projects/createProject');
const { updateProject } = require('../services/projects/updateProject');
const { getPaymentMilestones } = require('../services/projects/paymentMilestoneService');
const { getChecklistByProjectId, createChecklist, addItem } = require('../services/postSale/handoverService');
const projectRepository = require('../repositories/projectRepository');
const phasesRoutes = require('./phases');
const tasksRoutes = require('./tasks');
const documentsRoutes = require('./documents');
const designAssetsRoutes = require('./designAssets');
const designReviewsRoutes = require('./designReviews');
const materialPalettesRoutes = require('./materialPalettes');
const changeOrdersRoutes = require('./changeOrders');
const quotationsRoutes = require('./quotations');
const budgetRoutes = require('./budget');
const purchaseOrdersRoutes = require('./purchaseOrders');
const purchaseRequestsRoutes = require('./purchaseRequests');
const materialDeliveriesRoutes = require('./materialDeliveries');
const vendorPaymentsRoutes = require('./vendorPayments');
const materialSubstitutionsRoutes = require('./materialSubstitutions');
const productionOrdersRoutes = require('./productionOrders');
const workActivitiesRoutes = require('./workActivities');
const siteReadinessRoutes = require('./siteReadiness');
const taskDependenciesRoutes = require('./taskDependencies');
const dailySiteReportsRoutes = require('./dailySiteReports');
const roomProgressRoutes = require('./roomProgress');
const meetingNotesRoutes = require('./meetingNotes');
const delayNotificationsRoutes = require('./delayNotifications');
const drawingRegisterRoutes = require('./drawingRegister');
const punchListsRoutes = require('./punchLists');
const warrantiesRoutes = require('./warranties');
const amcsRoutes = require('./amcs');
const warrantyClaimsRoutes = require('./warrantyClaims');
const projectClosuresRoutes = require('./projectClosures');
const projectRetrospectivesRoutes = require('./projectRetrospectives');
const baselineAssessmentRoutes = require('./baselineAssessment');
const siteExpensesRoutes = require('./siteExpenses');
const materialUsagesRoutes = require('./materialUsages');
const labourAttendanceRoutes = require('./labourAttendance');
const paymentEscalationsRoutes = require('./paymentEscalations');


const verifyProjectBooked = require('../middleware/verifyBooking');

const router = express.Router();

const enforceProjectAccess = require('../middleware/enforceProjectAccess');

router.get('/debug-db', async (req, res, next) => {
  try {
    const { pool } = require('../config/db');
    await pool.query('ALTER TABLE tasks ADD COLUMN IF NOT EXISTS estimated_hours NUMERIC(10, 2) DEFAULT 0');
    const fs = require('fs');
    const path = require('path');
    const sql = fs.readFileSync(path.join(__dirname, '../../migrations/028_resource_allocations.sql'), 'utf8');
    await pool.query(sql);
    return res.json({ success: true, message: 'DB fixed' });
  } catch (error) {
    return res.json({ success: false, error: error.message, stack: error.stack });
  }
});

router.use(authenticate);

// Enforce project access for all routes containing a project ID parameter
router.param('id', enforceProjectAccess);
router.param('projectId', enforceProjectAccess);

// Get Project Activities
router.get('/:id/activities', authorize('projects:read'), async (req, res, next) => {
  try {
    const { pool } = require('../config/db');
    const { rows } = await pool.query(
      'SELECT * FROM activities WHERE project_id = $1 AND tenant_id = $2 ORDER BY created_at DESC',
      [req.params.id, req.tenantId]
    );
    return success(res, rows);
  } catch (error) {
    next(error);
  }
});

// Add Project Activity
router.post('/:id/activities', authorize('projects:write'), async (req, res, next) => {
  try {
    const { type, title, notes, outcome, metadata } = req.body;
    const { pool } = require('../config/db');
    const { rows } = await pool.query(
      `INSERT INTO activities (project_id, tenant_id, type, title, notes, outcome, metadata, user_id, created_at)
       VALUES ($1, $2, $3, $4, $5, $6, $7, $8, NOW()) RETURNING *`,
      [req.params.id, req.tenantId, type || 'note', title, notes, outcome, metadata, req.user?.id || null]
    );
    return success(res, rows[0]);
  } catch (error) {
    next(error);
  }
});

// Global factory production endpoints (must be defined before parameterized nested routes to prevent UUID conflict)
router.get('/factory/production-orders', authorize('factory:production_status'), async (req, res, next) => {
  try {
    const productionOrderController = require('../controllers/productionOrderController');
    await productionOrderController.getGlobalProductionOrders(req, res, next);
  } catch (error) {
    next(error);
  }
});

router.get('/factory/cnc-requests', authorize('factory:production_status'), async (req, res, next) => {
  try {
    const productionOrderController = require('../controllers/productionOrderController');
    await productionOrderController.getGlobalCNCRequests(req, res, next);
  } catch (error) {
    next(error);
  }
});

router.get('/coordination/dashboard', authorize('projects:read'), async (req, res, next) => {
  try {
    const { getCoordinationDashboard } = require('../services/projects/coordinationService');
    const data = await getCoordinationDashboard(req.tenantId);
    return success(res, data);
  } catch (error) {
    next(error);
  }
});

// Mount nested routes with verifyProjectBooked gate to ensure no project advances without booking confirmation
router.use('/:projectId/phases', verifyProjectBooked, phasesRoutes);
router.use('/:projectId/tasks', verifyProjectBooked, tasksRoutes);
router.use('/:projectId/documents', verifyProjectBooked, documentsRoutes);
router.use('/:projectId/design-assets', verifyProjectBooked, designAssetsRoutes);
router.use('/:projectId/design-reviews', verifyProjectBooked, designReviewsRoutes);
router.use('/:projectId/material-palettes', verifyProjectBooked, materialPalettesRoutes);
router.use('/:projectId/change-orders', verifyProjectBooked, changeOrdersRoutes);
router.use('/:projectId/quotations', verifyProjectBooked, quotationsRoutes);
router.use('/:projectId/budget', verifyProjectBooked, budgetRoutes);
router.use('/:projectId/purchase-orders', verifyProjectBooked, purchaseOrdersRoutes);
router.use('/:projectId/purchase-requests', verifyProjectBooked, purchaseRequestsRoutes);
router.use('/:projectId/material-deliveries', verifyProjectBooked, materialDeliveriesRoutes);
router.use('/:projectId/vendor-payments', verifyProjectBooked, vendorPaymentsRoutes);
router.use('/:projectId/material-substitutions', verifyProjectBooked, materialSubstitutionsRoutes);
router.use('/:projectId/production-orders', verifyProjectBooked, productionOrdersRoutes);
router.use('/:projectId/work-activities', verifyProjectBooked, workActivitiesRoutes);
router.use('/:projectId/site-readiness', verifyProjectBooked, siteReadinessRoutes);
router.use('/:projectId/task-dependencies', verifyProjectBooked, taskDependenciesRoutes);
router.use('/:projectId/daily-reports', verifyProjectBooked, dailySiteReportsRoutes);
router.use('/:projectId/room-progress', verifyProjectBooked, roomProgressRoutes);
router.use('/:projectId/meeting-notes', verifyProjectBooked, meetingNotesRoutes);
router.use('/:projectId/delay-notifications', verifyProjectBooked, delayNotificationsRoutes);
router.use('/:projectId/drawing-register', verifyProjectBooked, drawingRegisterRoutes);
router.use('/:projectId/punch-lists', verifyProjectBooked, punchListsRoutes);
router.use('/:projectId/warranties', verifyProjectBooked, warrantiesRoutes);
router.use('/:projectId/amcs', verifyProjectBooked, amcsRoutes);
router.use('/:projectId/warranty-claims', verifyProjectBooked, warrantyClaimsRoutes);
router.use('/:projectId/closure-checklist', verifyProjectBooked, projectClosuresRoutes);
router.use('/:projectId/retrospective', verifyProjectBooked, projectRetrospectivesRoutes);
router.use('/:projectId/baseline-assessment', verifyProjectBooked, baselineAssessmentRoutes);
router.use('/:projectId/attendance', verifyProjectBooked, labourAttendanceRoutes);
router.use('/:projectId/payment-escalations', verifyProjectBooked, paymentEscalationsRoutes);
router.use('/:projectId/site-expenses', verifyProjectBooked, siteExpensesRoutes);
router.use('/:projectId/material-usages', verifyProjectBooked, materialUsagesRoutes);



// Standard CRUD routes



const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.string().optional(),
  changeReason: z.string().optional(),
  warranty_exclusions: z.array(z.string()).optional().nullable(),
  warranty_terms_acknowledged: z.boolean().optional().nullable(),
  warranty_terms_acknowledged_at: z.string().optional().nullable(),
  warranty_terms_acknowledged_by: z.string().optional().nullable()
});



// Route to generate S3 pre-signed upload URL for contract document
router.post('/contract/upload-url', authorize('projects:create'), validate(uploadUrlSchema), async (req, res, next) => {
  try {
    const { name, mimeType } = req.body;

    const { getUploadUrl } = require('../services/documents/documentService');
    const result = await getUploadUrl({
      tenantId: req.tenantId,
      projectId: 'temp',
      name,
      mimeType
    });
    return success(res, result);
  } catch (error) {
    logger.error('[Projects Router] contract upload-url error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to generate contract upload URL.', 500);
  }
});

/**
 * @swagger
 * /api/projects:
 *   post:
 *     summary: Create a new project
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required:
 *               - client_name
 *               - name
 *     responses:
 *       201:
 *         description: Project created successfully
 *       400:
 *         description: Validation error
 */
router.post('/', authorize('projects:create'), validate(createProjectSchema), async (req, res, next) => {
  try {
    const { stripUnauthorizedEdits } = require('../utils/fieldMasker');
    const data = stripUnauthorizedEdits(req.body, 'projects', req.user.field_permissions);

    const project = await createProject({
      tenantId: req.tenantId,
      userId: req.user.userId,
      data
    });
    
    // Also filter outgoing project response just in case
    const { filterAllowedFields } = require('../utils/fieldMasker');
    const safeProject = filterAllowedFields(project, 'projects', req.user.field_permissions);

    return success(res, safeProject, {}, 201);
  } catch (error) {
    logger.error('[Projects Router] Create error:', error);
    return fail(res, 'INTERNAL_ERROR', 'An error occurred while creating the project.', 500);
  }
});

const dataScope = require('../middleware/dataScope');

// GET /api/projects
/**
 * @swagger
 * /api/projects:
 *   get:
 *     summary: List projects
 *     tags: [Projects]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: query
 *         name: status
 *         schema:
 *           type: string
 *         description: Filter by status
 *     responses:
 *       200:
 *         description: A list of projects
 */
router.get('/', authorize('projects:read'), dataScope('projects', 'pm_id', 'p'), async (req, res, next) => {
  try {
    const { status, pmId, designerId, search, page, limit, includeDeleted } = req.query;
    
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 20;

    const result = await projectRepository.findProjects(req.tenantId, {
      status,
      pmId,
      designerId,
      search,
      page: parsedPage,
      limit: parsedLimit,
      scopeFilter: req.scopeFilter,
      includeDeleted: includeDeleted === 'true'
    });

    const { filterAllowedFields } = require('../utils/fieldMasker');
    result.data = filterAllowedFields(result.data, 'projects', req.user.field_permissions);

    return paginate(res, result.data, result.total, result.page, result.limit);
  } catch (error) {
    logger.error('[Projects Router] List error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to retrieve projects list.', 500);
  }
});

// GET /api/projects/boq-variance
router.get('/boq-variance', authorize('projects:read'), require('../controllers/boqVarianceController').getPortfolioBOQVarianceReport);

// GET /api/projects/relationship-records
router.get('/relationship-records', authorize('projects:read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT cr.*, p.name as project_name 
       FROM client_relationship_records cr
       JOIN projects p ON cr.project_id = p.id
       WHERE cr.tenant_id = $1
       ORDER BY cr.next_followup_schedule_date ASC`,
      [req.tenantId]
    );
    return success(res, rows);
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/relationship-records/:id/followups
router.post('/relationship-records/:id/followups', authorize('projects:update'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { notes } = req.body;

    const check = await pool.query(
      'SELECT id, followup_notes FROM client_relationship_records WHERE id = $1 AND tenant_id = $2',
      [id, req.tenantId]
    );
    if (check.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Relationship record not found.', 404);
    }

    const currentNotes = check.rows[0].followup_notes || '';
    const newNotes = `${currentNotes}\n[${new Date().toISOString().split('T')[0]}] ${notes}`.trim();

    const { rows } = await pool.query(
      `UPDATE client_relationship_records
       SET last_followup_date = CURRENT_DATE,
           next_followup_schedule_date = CURRENT_DATE + interval '6 months',
           followup_notes = $1,
           updated_at = NOW()
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [newNotes, id, req.tenantId]
    );

    return success(res, rows[0]);
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/referrals
router.get('/referrals', authorize('projects:read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, p.name as referrer_project_name, p.client_name as referrer_client_name
       FROM client_referrals r
       JOIN projects p ON r.referrer_project_id = p.id
       WHERE r.tenant_id = $1
       ORDER BY r.created_at DESC`,
      [req.tenantId]
    );
    return success(res, rows);
  } catch (error) {
    next(error);
  }
});



// PATCH /api/projects/referrals/:id
router.patch('/referrals/:id', authorize('projects:update'), validate(updateReferralSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const data = req.body;

    const check = await pool.query(
      'SELECT id FROM client_referrals WHERE id = $1 AND tenant_id = $2',
      [id, req.tenantId]
    );
    if (check.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Referral record not found.', 404);
    }

    const { rows } = await pool.query(
      `UPDATE client_referrals
       SET referral_status = COALESCE($1, referral_status),
           reward_status = COALESCE($2, reward_status),
           reward_amount = COALESCE($3, reward_amount),
           notes = COALESCE($4, notes),
           updated_at = NOW()
       WHERE id = $5 AND tenant_id = $6
       RETURNING *`,
      [
        data.referralStatus || null,
        data.rewardStatus || null,
        data.rewardAmount !== undefined ? data.rewardAmount : null,
        data.notes || null,
        id,
        req.tenantId
      ]
    );

    return success(res, rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', error.errors, 400);
    next(error);
  }
});

// Standard CRUD routes

// GET /api/projects/handover/readiness-dashboard
router.get('/handover/readiness-dashboard', authorize('projects:read'), async (req, res, next) => {
  try {
    const { getReadinessDashboard } = require('../services/postSale/handoverReadinessService');
    const data = await getReadinessDashboard(req.tenantId);
    return success(res, data);
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/retention/dashboard
router.get('/retention/dashboard', authorize('projects:read'), async (req, res, next) => {
  try {
    const { getRetentionDashboard } = require('../services/postSale/retentionService');
    const data = await getRetentionDashboard(req.tenantId);
    return success(res, data);
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:projectId/members
router.get('/:projectId/members', authorize('projects:read'), async (req, res, next) => {
  try {
    const { pool } = require('../config/db');
    const { rows } = await pool.query(
      `SELECT pm.user_id, pm.role_in_project, pm.created_at, u.name, u.email 
       FROM project_members pm
       JOIN users u ON pm.user_id = u.id
       WHERE pm.project_id = $1 AND pm.tenant_id = $2`,
      [req.params.projectId, req.tenantId]
    );
    return success(res, rows);
  } catch (error) {
    logger.error('[Projects Router] Get members error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to retrieve project members.', 500);
  }
});

// POST /api/projects/:projectId/members/bulk
router.post('/:projectId/members/bulk', authorize('projects:manage_members'), async (req, res, next) => {
  try {
    const { userIds } = req.body;
    if (!Array.isArray(userIds)) return fail(res, 'VALIDATION_ERROR', 'userIds must be an array', 400);

    const { pool } = require('../config/db');
    
    // Begin bulk insert
    const client = await pool.connect();
    try {
      await client.query('BEGIN');
      for (const uid of userIds) {
        await client.query(
          `INSERT INTO project_members (tenant_id, project_id, user_id, assigned_by) 
           VALUES ($1, $2, $3, $4) 
           ON CONFLICT (project_id, user_id) DO NOTHING`,
          [req.tenantId, req.params.projectId, uid, req.user.userId]
        );
      }
      await client.query('COMMIT');
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }

    return success(res, { message: 'Members assigned successfully' });
  } catch (error) {
    logger.error('[Projects Router] Bulk assign members error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to assign project members.', 500);
  }
});

// DELETE /api/projects/:projectId/members/:userId
router.delete('/:projectId/members/:userId', authorize('projects:manage_members'), async (req, res, next) => {
  try {
    const { pool } = require('../config/db');
    await pool.query(
      'DELETE FROM project_members WHERE project_id = $1 AND user_id = $2 AND tenant_id = $3',
      [req.params.projectId, req.params.userId, req.tenantId]
    );
    return success(res, { message: 'Member removed successfully' });
  } catch (error) {
    logger.error('[Projects Router] Remove member error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to remove project member.', 500);
  }
});

// GET /api/projects/:projectId/boq-variance
router.get('/:projectId/boq-variance', authorize('projects:read'), require('../controllers/boqVarianceController').getProjectBOQVarianceReport);

// GET /api/projects/:id
router.get('/:id', authorize('projects:read'), async (req, res, next) => {
  try {
    const project = await projectRepository.findProjectById(req.tenantId, req.params.id, true);
    if (!project) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }

    const stats = await projectRepository.getProjectStats(req.tenantId, req.params.id);
    
    const { filterAllowedFields } = require('../utils/fieldMasker');
    const safeProject = filterAllowedFields({ ...project, stats }, 'projects', req.user.field_permissions);

    return success(res, safeProject);
  } catch (error) {
    logger.error('[Projects Router] Get by ID error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to retrieve project details.', 500);
  }
});

// PATCH /api/projects/:id
router.patch('/:id', authorize('projects:update'), validate(updateProjectSchema), async (req, res, next) => {
  try {
    const { pool } = require('../config/db');
    // Intercept if this ID belongs to a task or leave from Resource Capacity UI
    const { rows: raRows } = await pool.query('SELECT entity_type FROM resource_allocations WHERE entity_id = $1 LIMIT 1', [req.params.id]);
    if (raRows.length > 0 && raRows[0].entity_type !== 'project') {
      const type = raRows[0].entity_type;
      const hours = req.body.pm_hours_allocated !== undefined ? req.body.pm_hours_allocated : req.body.designer_hours_allocated;
      if (type === 'task' && hours !== undefined) {
         await pool.query('UPDATE tasks SET estimated_hours = $1 WHERE id = $2', [hours, req.params.id]);
         return success(res, { id: req.params.id, message: 'Task hours updated' });
      } else if (type === 'leave') {
         return success(res, { id: req.params.id, message: 'Leave hours cannot be edited here' });
      }
    }

    const { stripUnauthorizedEdits } = require('../utils/fieldMasker');
    const data = stripUnauthorizedEdits(req.body, 'projects', req.user.field_permissions);

    const updatedProject = await updateProject({
      tenantId: req.tenantId,
      userId: req.user.userId,
      projectId: req.params.id,
      data
    });

    const { filterAllowedFields } = require('../utils/fieldMasker');
    const safeProject = filterAllowedFields(updatedProject, 'projects', req.user.field_permissions);

    return success(res, safeProject);
  } catch (error) {
    if (error.code === 'BOOKING_REQUIRED') {
      return fail(res, 'BOOKING_REQUIRED', error.message, 400);
    }
    if (error.message === 'BOOKING_PAYMENT_REQUIRED' || error.code === 'BOOKING_PAYMENT_REQUIRED') {
      return fail(res, 'BOOKING_PAYMENT_REQUIRED', error.message, 400);
    }
    if (error.status === 400) {
      return fail(res, error.code || 'BAD_REQUEST', error.message, 400);
    }
    if (error.message === 'NOT_FOUND' || error.status === 404) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    logger.error('[Projects Router] Update error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update project.', 500);
  }
});

// DELETE /api/projects/:id
router.delete('/:id', authorize('projects:delete'), async (req, res, next) => {
  try {
    await projectRepository.softDeleteProject(req.tenantId, req.params.id);
    return res.status(204).send();
  } catch (error) {
    if (error.message === 'NOT_FOUND' || error.status === 404) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    logger.error('[Projects Router] Delete error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete project.', 500);
  }
});

// POST /api/projects/:id/cancel/preview
router.post('/:id/cancel/preview', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { previewCancellation } = require('../services/projects/cancelProject');
    const result = await previewCancellation({
      projectId: req.params.id,
      tenantId: req.tenantId
    });
    return success(res, result);
  } catch (error) {
    if (error.message === 'PROJECT_NOT_FOUND' || error.status === 404) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    if (error.status === 400) {
      return fail(res, 'BAD_REQUEST', error.message, 400);
    }
    next(error);
  }
});



// POST /api/projects/:id/cancel
router.post('/:id/cancel', authorize('projects:manage'), validate(cancelProjectSchema), async (req, res, next) => {
  try {
    const body = req.body;
    const { cancelProject } = require('../services/projects/cancelProject');
    const updated = await cancelProject({
      projectId: req.params.id,
      tenantId: req.tenantId,
      userId: req.user.id,
      ...body
    });
    return success(res, updated);
  } catch (error) {
    if (error.message === 'PROJECT_NOT_FOUND' || error.status === 404) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    if (error.status === 400) {
      return fail(res, 'BAD_REQUEST', error.message, 400);
    }
    next(error);
  }
});

// POST /api/projects/:id/acknowledge-cancellation
router.post('/:id/acknowledge-cancellation', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { acknowledgeCancellation } = require('../services/projects/cancelProject');
    const updated = await acknowledgeCancellation({
      projectId: req.params.id,
      tenantId: req.tenantId,
      userId: req.user.id
    });
    return success(res, updated);
  } catch (error) {
    if (error.message === 'PROJECT_NOT_FOUND' || error.status === 404) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    if (error.status === 400) {
      return fail(res, 'BAD_REQUEST', error.message, 400);
    }
    next(error);
  }
});


// GET /api/projects/:id/retention
router.get('/:id/retention', authorize('projects:read'), async (req, res, next) => {
  try {
    const { getRetentionSchedules } = require('../services/postSale/retentionService');
    const data = await getRetentionSchedules(req.params.id, req.tenantId);
    return success(res, data);
  } catch (error) {
    next(error);
  }
});



// PATCH /api/projects/:id/retention/:scheduleId
router.patch('/:id/retention/:scheduleId', authorize('projects:manage'), validate(updateRetentionSchema), async (req, res, next) => {
  try {
    const { status, actualDate, feedback, csatScore, notes } = req.body;

    const { updateRetentionSchedule } = require('../services/postSale/retentionService');
    const data = await updateRetentionSchedule(req.params.scheduleId, req.tenantId, {
      status, actualDate, feedback, csatScore, notes
    }, req.user.userId);

    return success(res, data, { message: 'Retention schedule updated successfully.' });
  } catch (error) {
    if (error.message === 'SCHEDULE_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Retention schedule not found', 404);
    }
    next(error);
  }
});

// POST /api/projects/:id/archive
router.post('/:id/archive', authorize('projects:update'), async (req, res, next) => {
  try {
    const { archiveProject } = require('../services/projects/archiveProject');
    const project = await archiveProject({
      projectId: req.params.id,
      tenantId: req.tenantId,
      userId: req.user.userId
    });
    return success(res, project, { message: 'Project archived successfully.' });
  } catch (error) {
    if (error.message === 'PROJECT_NOT_FOUND' || error.status === 404) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    logger.error('[Projects Router] Archive error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to archive project.', 500);
  }
});



// POST /api/projects/:id/reopen
router.post('/:id/reopen', authorize('projects:update'), validate(reopenProjectSchema), async (req, res, next) => {
  try {
    const { newStartDate, newTargetDate } = req.body;

    const { reopenProject } = require('../services/projects/reopenProject');
    const project = await reopenProject({
      projectId: req.params.id,
      tenantId: req.tenantId,
      userId: req.user.userId,
      newStartDate,
      newTargetDate
    });
    return success(res, project, { message: 'Project reopened successfully.' });
  } catch (error) {
    if (error.message === 'PROJECT_NOT_FOUND' || error.status === 404) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    if (error.message === 'PROJECT_ALREADY_ACTIVE' || error.status === 400) {
      return fail(res, 'BAD_REQUEST', error.message, 400);
    }
    logger.error('[Projects Router] Reopen error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to reopen project.', 500);
  }
});

// GET /api/projects/:id/payment-milestones
router.get('/:id/payment-milestones', authorize('projects:read'), async (req, res, next) => {
  try {
    const paymentMilestones = await getPaymentMilestones({
      tenantId: req.tenantId,
      projectId: req.params.id
    });
    return success(res, paymentMilestones);
  } catch (error) {
    logger.error('[Projects Router] Get Payment Milestones error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to retrieve payment milestones.', 500);
  }
});

// GET /api/projects/:id/handover/checklists
router.get('/:id/handover/checklists', authorize('projects:read'), async (req, res, next) => {
  try {
    const checklist = await getChecklistByProjectId(req.params.id, req.tenantId);
    if (!checklist) return fail(res, 'NOT_FOUND', 'Checklist not found', 404);
    return success(res, checklist);
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:id/handover/checklists
router.post('/:id/handover/checklists', authorize('projects:manage'), async (req, res, next) => {
  try {
    const items = req.body.items || [];
    const checklist = await createChecklist({
      tenantId: req.tenantId,
      projectId: req.params.id,
      items
    });
    return success(res, checklist, {}, 201);
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:id/handover/items
router.post('/:id/handover/items', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { checklistId, room, description, itemType } = req.body;
    if (!checklistId || !room || !description) return fail(res, 'BAD_REQUEST', 'Missing fields', 400);
    const item = await addItem({ checklistId, room, description, itemType });
    return success(res, item, {}, 201);
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id/handover/readiness
router.get('/:id/handover/readiness', authorize('projects:read'), async (req, res, next) => {
  try {
    const { evaluateReadinessGates } = require('../services/postSale/handoverReadinessService');
    const data = await evaluateReadinessGates(req.params.id, req.tenantId);
    return success(res, data);
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:id/handover/readiness/pm-sign-off
router.post('/:id/handover/readiness/pm-sign-off', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { pmSignOff } = require('../services/postSale/handoverReadinessService');
    const result = await pmSignOff(req.params.id, req.tenantId, req.user.userId);
    return success(res, result, { message: 'PM sign-off for handover readiness recorded successfully.' });
  } catch (error) {
    if (error.message === 'PROJECT_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    if (error.message === 'GATES_PENDING') {
      return fail(res, 'BAD_REQUEST', 'Cannot sign off. Outstanding gates are pending completion.', 400);
    }
    next(error);
  }
});

// GET /api/projects/:id/handover/appointments
router.get('/:id/handover/appointments', authorize('projects:read'), async (req, res, next) => {
  try {
    const { getProjectAppointments } = require('../services/postSale/handoverReadinessService');
    const data = await getProjectAppointments(req.params.id, req.tenantId);
    return success(res, data);
  } catch (error) {
    next(error);
  }
});



// POST /api/projects/:id/handover/appointments
router.post('/:id/handover/appointments', authorize('projects:manage'), validate(scheduleAppointmentSchema), async (req, res, next) => {
  try {
    const { appointmentDate, notes } = req.body;

    const { scheduleAppointment } = require('../services/postSale/handoverReadinessService');
    const result = await scheduleAppointment(req.params.id, req.tenantId, appointmentDate, notes, req.user.userId);
    return success(res, result, { message: 'Handover appointment scheduled successfully.' });
  } catch (error) {
    if (error.message === 'PROJECT_NOT_FOUND' || error.status === 404) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    if (error.message === 'READINESS_CHECK_FAILED') {
      return fail(res, 'BAD_REQUEST', 'Cannot schedule appointment. Handover readiness gates are not fully green.', 400);
    }
    next(error);
  }
});



router.post('/:id/apply-template', authorize('projects:manage'), async (req, res, next) => {
  try {
    const parsed = applySchema.safeParse(req.body);
    if (!parsed.success) {
      const error = new Error('Validation failed');
      error.isValidation = true;
      error.details = parsed.error.issues;
      return next(error);
    }

    const result = await applyTemplate(req.params.id, parsed.data.templateId, req.tenantId);
    return success(res, result);
  } catch (error) {
    if (error.message === 'TEMPLATE_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Template not found', 404);
    }
    if (error.message === 'PROJECT_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    next(error);
  }
});

// --- Design Requirements, Room Requirements & Inspirations ---
const pool = require('../config/db');







// GET /api/projects/:projectId/design-requirements
router.get('/:projectId/design-requirements', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    
    // 1. Fetch main design requirements
    const reqsRes = await pool.query(
      `SELECT * FROM project_design_requirements WHERE tenant_id = $1 AND project_id = $2`,
      [req.tenantId, projectId]
    );
    
    let designRequirements = reqsRes.rows[0];
    if (!designRequirements) {
      designRequirements = {
        project_id: projectId,
        interior_style: '',
        color_theme: '',
        material_preference: '',
        kitchen_style: '',
        wardrobe_style: '',
        lighting_preference: '',
        flooring_preference: '',
        lifestyle_inputs: '',
        must_haves: '',
        nice_to_haves: '',
        family_size: null,
        usage_patterns: '',
        storage_priorities: '',
        brand_flexibility: '',
        brand_remarks: '',
        existing_furniture: '',
        budget_category_allocation: {}
      };
    }
    
    // 2. Fetch room-by-room requirements
    const roomsRes = await pool.query(
      `SELECT * FROM project_room_requirements WHERE tenant_id = $1 AND project_id = $2 ORDER BY created_at ASC`,
      [req.tenantId, projectId]
    );
    
    // 3. Fetch inspirations
    const inspirationsRes = await pool.query(
      `SELECT * FROM project_inspirations WHERE tenant_id = $1 AND project_id = $2 ORDER BY created_at DESC`,
      [req.tenantId, projectId]
    );
    
    return success(res, {
      designRequirements,
      roomRequirements: roomsRes.rows,
      inspirations: inspirationsRes.rows
    });
  } catch (error) {
    next(error);
  }
});

// PUT /api/projects/:projectId/design-requirements
router.put('/:projectId/design-requirements', authorize('projects:update'), validate(designRequirementsSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const data = req.body;
    
    const query = `
      INSERT INTO project_design_requirements (
        tenant_id, project_id, interior_style, color_theme, material_preference,
        kitchen_style, wardrobe_style, lighting_preference, flooring_preference,
        lifestyle_inputs, must_haves, nice_to_haves,
        family_size, usage_patterns, storage_priorities, brand_flexibility, brand_remarks,
        existing_furniture, budget_category_allocation
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, $14, $15, $16, $17, $18, $19)
      ON CONFLICT (project_id) DO UPDATE SET
        interior_style = EXCLUDED.interior_style,
        color_theme = EXCLUDED.color_theme,
        material_preference = EXCLUDED.material_preference,
        kitchen_style = EXCLUDED.kitchen_style,
        wardrobe_style = EXCLUDED.wardrobe_style,
        lighting_preference = EXCLUDED.lighting_preference,
        flooring_preference = EXCLUDED.flooring_preference,
        lifestyle_inputs = EXCLUDED.lifestyle_inputs,
        must_haves = EXCLUDED.must_haves,
        nice_to_haves = EXCLUDED.nice_to_haves,
        family_size = EXCLUDED.family_size,
        usage_patterns = EXCLUDED.usage_patterns,
        storage_priorities = EXCLUDED.storage_priorities,
        brand_flexibility = EXCLUDED.brand_flexibility,
        brand_remarks = EXCLUDED.brand_remarks,
        existing_furniture = EXCLUDED.existing_furniture,
        budget_category_allocation = EXCLUDED.budget_category_allocation,
        updated_at = CURRENT_TIMESTAMP
      RETURNING *
    `;
    const values = [
      req.tenantId, projectId,
      data.interior_style || null,
      data.color_theme || null,
      data.material_preference || null,
      data.kitchen_style || null,
      data.wardrobe_style || null,
      data.lighting_preference || null,
      data.flooring_preference || null,
      data.lifestyle_inputs || null,
      data.must_haves || null,
      data.nice_to_haves || null,
      data.family_size || null,
      data.usage_patterns || null,
      data.storage_priorities || null,
      data.brand_flexibility || null,
      data.brand_remarks || null,
      data.existing_furniture || null,
      data.budget_category_allocation ? JSON.stringify(data.budget_category_allocation) : '{}'
    ];
    
    const { rows } = await pool.query(query, values);
    return success(res, rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', error.errors, 400);
    next(error);
  }
});

// POST /api/projects/:projectId/room-requirements
router.post('/:projectId/room-requirements', authorize('projects:update'), validate(roomRequirementSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const data = req.body;
    
    const query = `
      INSERT INTO project_room_requirements (
        tenant_id, project_id, room_name, budget_allocation, priority, functional_requirements, remarks
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *
    `;
    const values = [
      req.tenantId, projectId,
      data.room_name,
      data.budget_allocation !== undefined && data.budget_allocation !== null ? Number(data.budget_allocation) : null,
      data.priority || null,
      data.functional_requirements || null,
      data.remarks || null
    ];
    
    const { rows } = await pool.query(query, values);
    return success(res, rows[0], {}, 201);
  } catch (error) {
    if (error instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', error.errors, 400);
    next(error);
  }
});

// PUT /api/projects/:projectId/room-requirements/:id
router.put('/:projectId/room-requirements/:id', authorize('projects:update'), validate(roomRequirementSchema), async (req, res, next) => {
  try {
    const { projectId, id } = req.params;
    const data = req.body;
    
    const query = `
      UPDATE project_room_requirements SET
        room_name = $1,
        budget_allocation = $2,
        priority = $3,
        functional_requirements = $4,
        remarks = $5,
        updated_at = CURRENT_TIMESTAMP
      WHERE id = $6 AND project_id = $7 AND tenant_id = $8 RETURNING *
    `;
    const values = [
      data.room_name,
      data.budget_allocation !== undefined && data.budget_allocation !== null ? Number(data.budget_allocation) : null,
      data.priority || null,
      data.functional_requirements || null,
      data.remarks || null,
      id, projectId, req.tenantId
    ];
    
    const { rows } = await pool.query(query, values);
    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Room requirement not found', 404);
    return success(res, rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', error.errors, 400);
    next(error);
  }
});

// DELETE /api/projects/:projectId/room-requirements/:id
router.delete('/:projectId/room-requirements/:id', authorize('projects:update'), async (req, res, next) => {
  try {
    const { projectId, id } = req.params;
    const { rows } = await pool.query(
      `DELETE FROM project_room_requirements WHERE id = $1 AND project_id = $2 AND tenant_id = $3 RETURNING *`,
      [id, projectId, req.tenantId]
    );
    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Room requirement not found', 404);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:projectId/inspirations
router.post('/:projectId/inspirations', authorize('projects:update'), validate(inspirationSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const data = req.body;
    
    const query = `
      INSERT INTO project_inspirations (
        tenant_id, project_id, image_url, room_type, notes
      ) VALUES ($1, $2, $3, $4, $5) RETURNING *
    `;
    const values = [
      req.tenantId, projectId,
      data.image_url,
      data.room_type || null,
      data.notes || null
    ];
    
    const { rows } = await pool.query(query, values);
    return success(res, rows[0], {}, 201);
  } catch (error) {
    if (error instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', error.errors, 400);
    next(error);
  }
});

// DELETE /api/projects/:projectId/inspirations/:id
router.delete('/:projectId/inspirations/:id', authorize('projects:update'), async (req, res, next) => {
  try {
    const { projectId, id } = req.params;
    const { rows } = await pool.query(
      `DELETE FROM project_inspirations WHERE id = $1 AND project_id = $2 AND tenant_id = $3 RETURNING *`,
      [id, projectId, req.tenantId]
    );
    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Inspiration not found', 404);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:projectId/design-workflow
router.get('/:projectId/design-workflow', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;

    // 1. Fetch project stage info
    const projRes = await pool.query(
      `SELECT id, name, design_stage, is_scope_locked FROM projects WHERE id = $1 AND tenant_id = $2`,
      [projectId, tenantId]
    );
    if (projRes.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Project not found.', 404);
    }
    const project = projRes.rows[0];

    // 2. Fetch history
    const historyRes = await pool.query(
      `SELECT h.*, u.name as changed_by_name
       FROM project_design_stage_history h
       LEFT JOIN users u ON h.changed_by = u.id
       WHERE h.project_id = $1 AND h.tenant_id = $2
       ORDER BY h.created_at DESC`,
      [projectId, tenantId]
    );

    // 3. Compute Gate status
    // Gate A: Design Brief Completed
    const briefRes = await pool.query(
      `SELECT interior_style FROM project_design_requirements WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, tenantId]
    );
    const brief_completed = briefRes.rows.length > 0 && !!briefRes.rows[0].interior_style;

    // Gate B: Concept Uploaded
    const assetsRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM design_assets WHERE project_id = $1 AND tenant_id = $2 AND is_visible_to_client = true`,
      [projectId, tenantId]
    );
    const concept_uploaded = assetsRes.rows[0].count > 0;

    // Gate C: Concept Approved
    const approvedConceptRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM design_assets WHERE project_id = $1 AND tenant_id = $2 AND status = 'approved'`,
      [projectId, tenantId]
    );
    const historyConceptConfirmRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM project_design_stage_history WHERE project_id = $1 AND tenant_id = $2 AND to_stage = 'Concept Approval' AND client_confirmed = true`,
      [projectId, tenantId]
    );
    const concept_approved = approvedConceptRes.rows[0].count > 0 || historyConceptConfirmRes.rows[0].count > 0;

    // Gate D: Detailed Drawings Uploaded
    const docsRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM documents WHERE project_id = $1 AND tenant_id = $2 AND doc_type IN ('drawing', 'render')`,
      [projectId, tenantId]
    );
    const drawings_uploaded = docsRes.rows[0].count > 0;

    // Gate E: Drawings Approved
    const approvedDocsRes = await pool.query(
      `SELECT COUNT(*)::int as count FROM documents WHERE project_id = $1 AND tenant_id = $2 AND doc_type IN ('drawing', 'render') AND status = 'approved'`,
      [projectId, tenantId]
    );
    const drawings_approved = approvedDocsRes.rows[0].count > 0;

    const design_frozen = !!project.is_scope_locked;

    return success(res, {
      project_id: project.id,
      name: project.name,
      current_stage: project.design_stage || 'Requirement Gathering',
      is_scope_locked: design_frozen,
      gates: {
        brief_completed,
        concept_uploaded,
        concept_approved,
        drawings_uploaded,
        drawings_approved,
        design_frozen
      },
      history: historyRes.rows
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:projectId/design-workflow/transition
router.post('/:projectId/design-workflow/transition', authorize('projects:update'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const { to_stage, comments } = req.body;

    const VALID_STAGES = [
      'Requirement Gathering',
      'Concept Presentation',
      'Concept Approval',
      'Detailed Design',
      'Client Review',
      'Revision Rounds',
      'Design Freeze'
    ];

    if (!VALID_STAGES.includes(to_stage)) {
      return fail(res, 'VALIDATION_ERROR', 'Invalid target stage name.', 400);
    }

    // 1. Fetch project stage info
    const projRes = await pool.query(
      `SELECT id, name, design_stage, is_scope_locked FROM projects WHERE id = $1 AND tenant_id = $2`,
      [projectId, tenantId]
    );
    if (projRes.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Project not found.', 404);
    }
    const project = projRes.rows[0];
    const from_stage = project.design_stage || 'Requirement Gathering';

    if (from_stage === to_stage) {
      return fail(res, 'VALIDATION_ERROR', 'Project is already in this stage.', 400);
    }

    // 2. Validate gates depending on target stage
    if (to_stage === 'Concept Presentation') {
      const briefRes = await pool.query(
        `SELECT interior_style FROM project_design_requirements WHERE project_id = $1 AND tenant_id = $2`,
        [projectId, tenantId]
      );
      const brief_completed = briefRes.rows.length > 0 && !!briefRes.rows[0].interior_style;
      if (!brief_completed) {
        return fail(res, 'STAGE_GATE_FAILED', 'Design brief must be completed and saved before moving to Concept Presentation.', 422);
      }
    }

    if (to_stage === 'Concept Approval') {
      const assetsRes = await pool.query(
        `SELECT COUNT(*)::int as count FROM design_assets WHERE project_id = $1 AND tenant_id = $2 AND is_visible_to_client = true`,
        [projectId, tenantId]
      );
      if (assetsRes.rows[0].count === 0) {
        return fail(res, 'STAGE_GATE_FAILED', 'At least one Concept or Mood Board must be uploaded and visible to client before Concept Approval stage.', 422);
      }
    }

    if (to_stage === 'Detailed Design') {
      const approvedConceptRes = await pool.query(
        `SELECT COUNT(*)::int as count FROM design_assets WHERE project_id = $1 AND tenant_id = $2 AND status = 'approved'`,
        [projectId, tenantId]
      );
      const historyConceptConfirmRes = await pool.query(
        `SELECT COUNT(*)::int as count FROM project_design_stage_history WHERE project_id = $1 AND tenant_id = $2 AND to_stage = 'Concept Approval' AND client_confirmed = true`,
        [projectId, tenantId]
      );
      const concept_approved = approvedConceptRes.rows[0].count > 0 || historyConceptConfirmRes.rows[0].count > 0;
      if (!concept_approved) {
        return fail(res, 'STAGE_GATE_FAILED', 'Concept must be approved by client before starting Detailed Design.', 422);
      }
    }

    if (to_stage === 'Client Review') {
      const docsRes = await pool.query(
        `SELECT COUNT(*)::int as count FROM documents WHERE project_id = $1 AND tenant_id = $2 AND doc_type IN ('drawing', 'render')`,
        [projectId, tenantId]
      );
      if (docsRes.rows[0].count === 0) {
        return fail(res, 'STAGE_GATE_FAILED', 'At least one drawing or render must be uploaded before launching Client Review.', 422);
      }
    }

    if (to_stage === 'Design Freeze') {
      await pool.query(
        `UPDATE projects SET is_scope_locked = true, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
        [projectId, tenantId]
      );
    } else {
      if (from_stage === 'Design Freeze') {
        await pool.query(
          `UPDATE projects SET is_scope_locked = false, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
          [projectId, tenantId]
        );
      }
    }

    // Update project stage
    await pool.query(
      `UPDATE projects SET design_stage = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3`,
      [to_stage, projectId, tenantId]
    );

    // Insert history
    const histRes = await pool.query(
      `INSERT INTO project_design_stage_history (
        tenant_id, project_id, from_stage, to_stage, changed_by, client_confirmed, comments
      ) VALUES ($1, $2, $3, $4, $5, $6, $7) RETURNING *`,
      [tenantId, projectId, from_stage, to_stage, req.userId, false, comments || 'Stage transition']
    );

    return success(res, { current_stage: to_stage, history: histRes.rows[0] });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:projectId/design-workflow/client-confirm
router.post('/:projectId/design-workflow/client-confirm', authorize('projects:update'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const { comments } = req.body;

    // Get current stage
    const projRes = await pool.query(
      `SELECT id, design_stage FROM projects WHERE id = $1 AND tenant_id = $2`,
      [projectId, tenantId]
    );
    if (projRes.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Project not found.', 404);
    }
    const current_stage = projRes.rows[0].design_stage || 'Requirement Gathering';

    // Set client_confirmed = true for the latest history record of this stage
    const lastHistRes = await pool.query(
      `SELECT id FROM project_design_stage_history
       WHERE project_id = $1 AND tenant_id = $2 AND to_stage = $3
       ORDER BY created_at DESC LIMIT 1`,
      [projectId, tenantId, current_stage]
    );

    let historyRecord;
    if (lastHistRes.rows.length > 0) {
      const updateHist = await pool.query(
        `UPDATE project_design_stage_history
         SET client_confirmed = true, client_confirmed_at = NOW(), comments = COALESCE($1, comments)
         WHERE id = $2 RETURNING *`,
        [comments, lastHistRes.rows[0].id]
      );
      historyRecord = updateHist.rows[0];
    } else {
      const insertHist = await pool.query(
        `INSERT INTO project_design_stage_history (
          tenant_id, project_id, from_stage, to_stage, changed_by, client_confirmed, client_confirmed_at, comments
        ) VALUES ($1, $2, $3, $4, $5, $6, NOW(), $7) RETURNING *`,
        [tenantId, projectId, current_stage, current_stage, req.userId, true, comments || 'Client signoff']
      );
      historyRecord = insertHist.rows[0];
    }

    // Auto progress from Concept Approval to Detailed Design if client approved
    if (current_stage === 'Concept Approval') {
      await pool.query(
        `UPDATE projects SET design_stage = 'Detailed Design', updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
        [projectId, tenantId]
      );
      await pool.query(
        `INSERT INTO project_design_stage_history (
          tenant_id, project_id, from_stage, to_stage, changed_by, client_confirmed, client_confirmed_at, comments
        ) VALUES ($1, $2, 'Concept Approval', 'Detailed Design', $3, false, null, 'Auto-progressed after concept approval')`,
        [tenantId, projectId, req.userId]
      );
      return success(res, { current_stage: 'Detailed Design', message: 'Concept approved, auto-progressed to Detailed Design.' });
    }

    if (current_stage === 'Design Freeze') {
      await pool.query(
        `UPDATE projects SET is_scope_locked = true, updated_at = NOW() WHERE id = $1 AND tenant_id = $2`,
        [projectId, tenantId]
      );
    }

    return success(res, { current_stage, history: historyRecord });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:projectId/schedule-revisions
router.get('/:projectId/schedule-revisions', authorize('projects:read'), async (req, res) => {
  try {
    const { rows } = await pool.query(
      `SELECT r.*, u.name as revised_by_name
       FROM project_schedule_revisions r
       LEFT JOIN users u ON r.revised_by = u.id
       WHERE r.tenant_id = $1 AND r.project_id = $2
       ORDER BY r.revision_number DESC, r.revised_at DESC`,
      [req.tenantId, req.params.projectId]
    );
    return success(res, rows);
  } catch (error) {
    logger.error('[Projects Router] Fetch schedule revisions error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch schedule revisions.', 500);
  }
});



// POST /api/projects/:projectId/replace-resource
router.post('/:projectId/replace-resource', authorize('projects:manage'), validate(replaceResourceSchema), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { replaceResource } = require('../services/projects/replaceResourceService');
    
    const data = req.body;
    
    const handover = await replaceResource({
      tenantId: req.tenantId,
      userId: req.userId,
      projectId,
      role: data.role,
      newResourceId: data.newResourceId,
      handoverNotes: data.handoverNotes
    });
    
    return success(res, handover, {}, 200);
  } catch (error) {
    if (error.status) return fail(res, error.message, error.message, error.status);
    next(error);
  }
});

// GET /api/projects/:projectId/handovers
router.get('/:projectId/handovers', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { rows } = await pool.query(
      `SELECT 
         prh.*,
         ru.name as replaced_user_name,
         au.name as assigned_user_name,
         cu.name as creator_name
       FROM project_resource_handovers prh
       LEFT JOIN users ru ON prh.replaced_user_id = ru.id
       LEFT JOIN users au ON prh.assigned_user_id = au.id
       LEFT JOIN users cu ON prh.created_by = cu.id
       WHERE prh.tenant_id = $1 AND prh.project_id = $2
       ORDER BY prh.created_at DESC`,
      [req.tenantId, projectId]
    );
    return success(res, rows);
  } catch (error) {
    next(error);
  }
});



// POST /api/projects/:id/pause
router.post('/:id/pause', authorize('projects:update'), validate(pauseProjectSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { reason, expectedResumeDate, clientCommunication, resourceReleaseInstructions, siteSecurityPlan } = req.body;
    const { pauseProject } = require('../services/projects/pauseProject');

    const project = await pauseProject({
      projectId: id,
      tenantId: req.tenantId,
      userId: req.user.userId,
      reason,
      expectedResumeDate,
      resourceReleaseInstructions,
      siteSecurityPlan,
      clientCommunication
    });

    return success(res, project, { message: 'Project paused successfully.' });
  } catch (error) {
    if (error instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', error.errors, 400);
    if (error.status) return fail(res, error.message, error.message, error.status);
    next(error);
  }
});



// POST /api/projects/:id/resume
router.post('/:id/resume', authorize('projects:update'), validate(resumeProjectSchema), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { siteConditionVerified, materialStatusVerified } = req.body;
    const { resumeProject } = require('../services/projects/pauseProject');

    const project = await resumeProject({
      projectId: id,
      tenantId: req.tenantId,
      userId: req.user.userId,
      siteConditionVerified,
      materialStatusVerified
    });

    return success(res, project, { message: 'Project resumed successfully.' });
  } catch (error) {
    if (error.status) return fail(res, error.message, error.message, error.status);
    next(error);
  }
});



// POST /api/projects/:projectId/boq-items/:itemId/discontinue
router.post('/:projectId/boq-items/:itemId/discontinue', authorize('projects:update'), async (req, res, next) => {
  try {
    const { _projectId, itemId } = req.params;
    
    // Check if the item belongs to the tenant and exists
    const checkRes = await pool.query(
      'SELECT id FROM quotation_items WHERE id = $1 AND tenant_id = $2',
      [itemId, req.tenantId]
    );
    if (checkRes.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'BOQ item not found', 404);
    }

    // Set is_discontinued = true
    const updateRes = await pool.query(
      `UPDATE quotation_items 
       SET is_discontinued = TRUE, 
           updated_at = NOW() 
       WHERE id = $1 AND tenant_id = $2 
       RETURNING *`,
      [itemId, req.tenantId]
    );

    const { logAction } = require('../services/auditLog');
    await logAction({
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: 'boq_item.discontinued',
      entity: 'quotation_item',
      entityId: itemId,
      oldValue: { is_discontinued: false },
      newValue: { is_discontinued: true }
    });

    return success(res, updateRes.rows[0], { message: 'BOQ item flagged as discontinued.' });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:projectId/room-handovers
router.get('/:projectId/room-handovers', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;

    // 1. Fetch distinct rooms from handover items for this project
    const roomsRes = await pool.query(
      `SELECT DISTINCT hi.room 
       FROM handover_items hi
       JOIN handover_checklists hc ON hi.checklist_id = hc.id
       WHERE hc.project_id = $1 AND hc.tenant_id = $2`,
      [projectId, req.tenantId]
    );
    const rooms = roomsRes.rows.map(r => r.room);

    // 2. Fetch existing room handovers
    const handoversRes = await pool.query(
      `SELECT room_name, status, signed_off_at, client_name 
       FROM project_room_handovers 
       WHERE project_id = $1 AND tenant_id = $2`,
      [projectId, req.tenantId]
    );
    const handoversMap = {};
    handoversRes.rows.forEach(h => {
      handoversMap[h.room_name] = h;
    });

    // 3. Construct response mapping each room
    const result = rooms.map(room => {
      const match = handoversMap[room];
      return {
        room,
        status: match ? match.status : 'pending',
        signedOffAt: match ? match.signed_off_at : null,
        clientName: match ? match.client_name : null
      };
    });

    return success(res, result);
  } catch (error) {
    next(error);
  }
});



// POST /api/projects/:projectId/handover/sign-off
router.post('/:projectId/handover/sign-off', authorize('projects:update'), validate(handoverSignOffSchema), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { projectId } = req.params;
    const { checklistId, roomName, clientName, clientSignatureData, otp } = req.body;

    await client.query('BEGIN');

    // 1. Check checklist authorization status
    const checklistRes = await client.query(
      `SELECT is_internally_authorized FROM handover_checklists 
       WHERE id = $1 AND project_id = $2 AND tenant_id = $3`,
      [checklistId, projectId, req.tenantId]
    );
    if (checklistRes.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Handover checklist not found', 404);
    }
    if (!checklistRes.rows[0].is_internally_authorized) {
      return fail(res, 'INTERNAL_AUTHORIZATION_PENDING', 'Handover checklist is not internally authorized by a senior PM.', 400);
    }

    // 2. Validate all items for this room are checked
    const itemsRes = await client.query(
      `SELECT COUNT(*)::int as total, SUM(CASE WHEN is_checked THEN 1 ELSE 0 END)::int as checked 
       FROM handover_items 
       WHERE checklist_id = $1 AND room = $2`,
      [checklistId, roomName]
    );
    const { total, checked } = itemsRes.rows[0];
    if (total === 0) {
      return fail(res, 'NOT_FOUND', `No handover items found for room: ${roomName}`, 404);
    }
    if (checked < total) {
      return fail(res, 'ROOM_ITEMS_INCOMPLETE', `Cannot sign off room ${roomName} because ${total - checked} items are pending.`, 400);
    }

    // 3. Perform OTP Verification (Mock implementation or validation)
    if (otp !== '1234' && otp !== '4321') {
      return fail(res, 'INVALID_OTP', 'The OTP code is invalid.', 400);
    }

    // 4. Update or Insert project_room_handovers
    const handoverRes = await client.query(
      `INSERT INTO project_room_handovers 
       (project_id, tenant_id, room_name, status, signed_off_at, signed_off_by_user_id, client_otp_verified, client_name, client_signature_data)
       VALUES ($1, $2, $3, 'signed_off', NOW(), $4, TRUE, $5, $6)
       ON CONFLICT (project_id, room_name) DO UPDATE 
       SET status = 'signed_off', 
           signed_off_at = NOW(), 
           signed_off_by_user_id = $4, 
           client_otp_verified = TRUE, 
           client_name = $5, 
           client_signature_data = $6, 
           updated_at = NOW()
       RETURNING *`,
      [projectId, req.tenantId, roomName, req.user.userId, clientName, clientSignatureData || null]
    );

    // 5. Enqueue automated PDF generation job
    await client.query(
      `INSERT INTO automation_jobs (tenant_id, event_type, entity, record)
       VALUES ($1, 'generate_room_handover_pdf', 'project_room_handovers', $2)`,
      [req.tenantId, JSON.stringify({ projectId, roomName, clientName })]
    );

    // 6. Log audit action
    const { logAction } = require('../services/auditLog');
    await logAction({
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: 'project.room_handed_over',
      entity: 'project',
      entityId: projectId,
      oldValue: { room: roomName, status: 'pending' },
      newValue: { room: roomName, status: 'signed_off', clientName }
    }, client);

    await client.query('COMMIT');
    return success(res, handoverRes.rows[0], { message: `Room ${roomName} successfully handed over.` });
  } catch (error) {
    await client.query('ROLLBACK');
    next(error);
  } finally {
    client.release();
  }
});

// GET /api/projects/:projectId/compliance
router.get('/:projectId/compliance', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { rows } = await pool.query(
      `SELECT * FROM project_compliance_checklists 
       WHERE project_id = $1 AND tenant_id = $2
       ORDER BY created_at ASC`,
      [projectId, req.tenantId]
    );
    return success(res, rows);
  } catch (error) {
    next(error);
  }
});



// PATCH /api/projects/:projectId/compliance/:itemId
router.patch('/:projectId/compliance/:itemId', authorize('projects:update'), validate(updateComplianceSchema), async (req, res, next) => {
  try {
    const { projectId, itemId } = req.params;
    const { status, notes } = req.body;

    const checkRes = await pool.query(
      'SELECT id, status, notes FROM project_compliance_checklists WHERE id = $1 AND project_id = $2 AND tenant_id = $3',
      [itemId, projectId, req.tenantId]
    );
    if (checkRes.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Compliance item not found.', 404);
    }
    const oldValue = checkRes.rows[0];

    const approvedAt = status === 'approved' ? 'NOW()' : 'NULL';
    const approvedBy = status === 'approved' ? `$1` : 'NULL';

    const updateQuery = `
      UPDATE project_compliance_checklists 
      SET status = $2, 
          notes = $3, 
          approved_by = ${approvedBy}, 
          approved_at = ${approvedAt}, 
          updated_at = NOW()
      WHERE id = $4 AND project_id = $5 AND tenant_id = $6
      RETURNING *
    `;

    const { rows } = await pool.query(updateQuery, [
      status === 'approved' ? req.user.userId : null,
      status,
      notes || null,
      itemId,
      projectId,
      req.tenantId
    ]);

    const { logAction } = require('../services/auditLog');
    await logAction({
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: 'project.compliance_updated',
      entity: 'project_compliance',
      entityId: itemId,
      oldValue,
      newValue: rows[0]
    });

    return success(res, rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', error.errors, 400);
    next(error);
  }
});

// GET /api/projects/:projectId/mep-checklist
router.get('/:projectId/mep-checklist', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;

    const { rows } = await pool.query(
      `SELECT pmc.*, u.name as approved_by_name
       FROM project_mep_checklists pmc
       LEFT JOIN users u ON pmc.approved_by = u.id
       WHERE pmc.project_id = $1 AND pmc.tenant_id = $2
       ORDER BY pmc.created_at ASC`,
      [projectId, tenantId]
    );

    if (rows.length > 0) {
      return success(res, rows);
    }

    const mepItems = [
      'Electrical switch and socket layout marking verification',
      'False ceiling lighting and electrical points alignment coordination',
      'Plumbing routing slopes and structural beam clearance verification',
      'MEP contractors & site team design clash resolution review',
      'Client formal sign-off on layout point adjustments',
      'Contractor drawing clearance before civil execution starts'
    ];

    const seededRows = [];
    for (const item of mepItems) {
      const insertRes = await pool.query(
        `INSERT INTO project_mep_checklists (tenant_id, project_id, item_name, status)
         VALUES ($1, $2, $3, 'pending')
         ON CONFLICT (project_id, item_name) DO UPDATE SET tenant_id = EXCLUDED.tenant_id
         RETURNING *`,
        [tenantId, projectId, item]
      );
      seededRows.push(insertRes.rows[0]);
    }

    return success(res, seededRows);
  } catch (error) {
    next(error);
  }
});



// PATCH /api/projects/:projectId/mep-checklist/:itemId
router.patch('/:projectId/mep-checklist/:itemId', authorize('projects:update'), validate(updateMepChecklistSchema), async (req, res, next) => {
  try {
    const { projectId, itemId } = req.params;
    const tenantId = req.tenantId;
    const { status, notes } = req.body;

    const checkRes = await pool.query(
      'SELECT id, status, notes FROM project_mep_checklists WHERE id = $1 AND project_id = $2 AND tenant_id = $3',
      [itemId, projectId, tenantId]
    );
    if (checkRes.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'MEP checklist item not found.', 404);
    }
    const oldValue = checkRes.rows[0];

    const approvedAt = status === 'approved' ? 'NOW()' : 'NULL';
    const approvedBy = status === 'approved' ? `$1` : 'NULL';

    const updateQuery = `
      UPDATE project_mep_checklists
      SET status = $2,
          notes = $3,
          approved_by = ${approvedBy},
          approved_at = ${approvedAt},
          updated_at = NOW()
      WHERE id = $4 AND project_id = $5 AND tenant_id = $6
      RETURNING *
    `;

    const { rows } = await pool.query(updateQuery, [
      status === 'approved' ? req.user.userId : null,
      status,
      notes || null,
      itemId,
      projectId,
      tenantId
    ]);

    const { logAction } = require('../services/auditLog');
    await logAction({
      tenantId,
      userId: req.user.userId,
      action: 'project.mep_checklist_updated',
      entity: 'project_mep_checklist',
      entityId: itemId,
      oldValue,
      newValue: rows[0]
    });

    return success(res, rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', error.errors, 400);
    next(error);
  }
});

// GET /api/projects/:projectId/vendor-coordination
router.get('/:projectId/vendor-coordination', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { rows } = await pool.query(
      `SELECT 
         id, 
         vendor_name, 
         scope_of_work, 
         scheduled_start_date, 
         scheduled_finish_date, 
         blocker_description, 
         current_status,
         default_date,
         work_completed_assessment,
         outstanding_scope,
         replacement_vendor_id,
         financial_recovery_amount,
         financial_recovery_status
       FROM project_vendors 
       WHERE project_id = $1 AND tenant_id = $2
       ORDER BY scheduled_start_date ASC, created_at ASC`,
      [projectId, req.tenantId]
    );
    return success(res, rows);
  } catch (error) {
    next(error);
  }
});



// PATCH /api/projects/:projectId/vendor-coordination/:vendorId
router.patch('/:projectId/vendor-coordination/:vendorId', authorize('projects:update'), validate(updateVendorCoordinationSchema), async (req, res, next) => {
  try {
    const { projectId, vendorId } = req.params;
    const data = req.body;

    const checkRes = await pool.query(
      `SELECT id, scheduled_start_date, scheduled_finish_date, blocker_description, current_status 
       FROM project_vendors WHERE id = $1 AND project_id = $2 AND tenant_id = $3`,
      [vendorId, projectId, req.tenantId]
    );
    if (checkRes.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Project vendor not found.', 404);
    }
    const oldValue = checkRes.rows[0];

    const { rows } = await pool.query(
      `UPDATE project_vendors
       SET scheduled_start_date = COALESCE($1, scheduled_start_date),
           scheduled_finish_date = COALESCE($2, scheduled_finish_date),
           blocker_description = COALESCE($3, blocker_description),
           current_status = COALESCE($4, current_status),
           updated_at = NOW()
       WHERE id = $5 AND project_id = $6 AND tenant_id = $7
       RETURNING *`,
      [
        data.scheduledStartDate || null,
        data.scheduledFinishDate || null,
        data.blockerDescription || null,
        data.currentStatus || null,
        vendorId,
        projectId,
        req.tenantId
      ]
    );

    const { logAction } = require('../services/auditLog');
    await logAction({
      tenantId: req.tenantId,
      userId: req.user.userId,
      action: 'project.vendor_coordination_updated',
      entity: 'project_vendor',
      entityId: vendorId,
      oldValue,
      newValue: { ...rows[0] }
    });

    return success(res, rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', error.errors, 400);
    next(error);
  }
});



// PATCH /api/projects/:projectId/vendors/:vendorId/recovery
router.patch('/:projectId/vendors/:vendorId/recovery', authorize('projects:manage'), validate(vendorRecoverySchema), async (req, res, next) => {
  try {
    const { projectId, vendorId } = req.params;
    const data = req.body;

    const checkRes = await pool.query(
      `SELECT id FROM project_vendors WHERE id = $1 AND project_id = $2 AND tenant_id = $3 AND (status = 'defaulted' OR current_status = 'defaulted')`,
      [vendorId, projectId, req.tenantId]
    );
    if (checkRes.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Defaulted project vendor not found.', 404);
    }

    let query = `UPDATE project_vendors SET financial_recovery_status = $1, updated_at = NOW()`;
    const params = [data.financialRecoveryStatus, vendorId, projectId, req.tenantId];
    if (data.financialRecoveryAmount !== undefined) {
      query = `UPDATE project_vendors SET financial_recovery_status = $1, financial_recovery_amount = $2, updated_at = NOW()`;
      params.splice(1, 0, data.financialRecoveryAmount);
    }

    query += ` WHERE id = $${params.length - 2} AND project_id = $${params.length - 1} AND tenant_id = $${params.length} RETURNING *`;

    const { rows } = await pool.query(query, params);

    return success(res, rows[0]);
  } catch (error) {
    if (error instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', error.errors, 400);
    next(error);
  }
});

// GET /api/projects/:id/booking
router.get('/:id/booking', authorize('projects:read'), async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      `SELECT pb.*, u.name as designer_name, u_conf.name as confirmed_by_name
       FROM project_bookings pb
       LEFT JOIN users u ON pb.assigned_designer_id = u.id
       LEFT JOIN users u_conf ON pb.confirmed_by = u_conf.id
       WHERE pb.project_id = $1 AND pb.tenant_id = $2`,
      [req.params.id, req.tenantId]
    );
    if (rows.length === 0) {
      return success(res, null);
    }
    return success(res, rows[0]);
  } catch (error) {
    next(error);
  }
});


// POST /api/projects/:id/booking/confirm
router.post('/:id/booking/confirm', authenticate, authorize('projects:manage'), validate(confirmBookingSchema), async (req, res, next) => {

  try {
    const data = req.body;
    const projectId = req.params.id;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const projRes = await pool.query(
      'SELECT * FROM projects WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL',
      [projectId, tenantId]
    );
    if (projRes.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    const project = projRes.rows[0];

    const bookingCheck = await pool.query(
      'SELECT id FROM project_bookings WHERE project_id = $1 AND tenant_id = $2',
      [projectId, tenantId]
    );
    if (bookingCheck.rows.length > 0) {
      return fail(res, 'CONFLICT', 'Booking has already been confirmed for this project.', 409);
    }

    const client = await pool.connect();
    try {
      await client.query('BEGIN');

      const insertBookingQuery = `
        INSERT INTO project_bookings (
          tenant_id, project_id, advance_amount, payment_method,
          agreement_file_key, agreement_file_name, agreement_file_size, agreement_file_mime,
          agreed_scope_summary, design_freeze_target_date, project_start_date,
          assigned_designer_id, confirmed_by, confirmed_at
        ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12, $13, NOW())
        RETURNING *
      `;
      const insertBookingValues = [
        tenantId, projectId, data.advance_amount, data.payment_method,
        data.agreement_file_key || null, data.agreement_file_name || null,
        data.agreement_file_size || null, data.agreement_file_mime || null,
        data.agreed_scope_summary, data.design_freeze_target_date, data.project_start_date,
        data.assigned_designer_id, userId
      ];
      const bookingRes = await client.query(insertBookingQuery, insertBookingValues);
      const bookingRecord = bookingRes.rows[0];

      // Update project attributes and status
      await client.query(
        `UPDATE projects 
         SET status = 'active',
             start_date = $1,
             designer_id = $2,
             booking_amount = $3,
             updated_at = NOW()
         WHERE id = $4 AND tenant_id = $5`,
        [data.project_start_date, data.assigned_designer_id, data.advance_amount, projectId, tenantId]
      );

      // Register contract document
      if (data.agreement_file_key) {
        await client.query(
          `INSERT INTO documents (
            tenant_id, project_id, name, doc_type, version, storage_key, file_size_bytes, mime_type, uploaded_by, status
          ) VALUES ($1, $2, $3, $4, 1, $5, $6, $7, $8, 'approved')
           ON CONFLICT DO NOTHING`,
          [
            tenantId,
            projectId,
            data.agreement_file_name,
            'contract',
            data.agreement_file_key,
            data.agreement_file_size || null,
            data.agreement_file_mime || null,
            userId
          ]
        );
      }

      // Check payment milestone
      const milestoneRes = await client.query(
        "SELECT id FROM payment_milestones WHERE project_id = $1 AND tenant_id = $2 AND name = 'Booking Advance' LIMIT 1",
        [projectId, tenantId]
      );
      if (milestoneRes.rows.length > 0) {
        await client.query(
          `UPDATE payment_milestones 
           SET amount = $1, 
               status = 'paid', 
               paid_amount = $1, 
               paid_at = $2
           WHERE id = $3`,
          [data.advance_amount, new Date().toISOString(), milestoneRes.rows[0].id]
        );
      } else {
        const contractVal = Number(project.contract_value || data.advance_amount);
        const percentage = contractVal > 0 
          ? ((data.advance_amount / contractVal) * 100).toFixed(2)
          : 100.00;

        await client.query(
          `INSERT INTO payment_milestones (
            tenant_id, project_id, name, amount, percentage, status, paid_amount, paid_at
          ) VALUES ($1, $2, 'Booking Advance', $3, $4, 'paid', $3, $5)`,
          [tenantId, projectId, data.advance_amount, percentage, new Date().toISOString()]
        );
      }

      await client.query('COMMIT');

      const { logAction } = require('../services/auditLog');
      await logAction({
        tenantId,
        userId,
        action: 'project.booking_confirmed',
        entity: 'project',
        entityId: projectId,
        newValue: bookingRecord
      });

      return success(res, bookingRecord, { message: 'Booking confirmed and project activated successfully.' });
    } catch (error) {
      await client.query('ROLLBACK');
      throw error;
    } finally {
      client.release();
    }
  } catch (error) {
    if (error instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', error.errors, 400);
    next(error);
  }
});

// GET /api/projects/:id/commercial-approval
router.get('/:id/commercial-approval', authenticate, authorize('projects:read'), async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const tenantId = req.tenantId;

    // 1. BOQ Accepted check: status = 'accepted' and accepted_at is not null
    const boqRes = await pool.query(
      "SELECT id, quotation_number, accepted_at FROM quotations WHERE project_id = $1 AND tenant_id = $2 AND status = 'accepted' AND accepted_at IS NOT NULL LIMIT 1",
      [projectId, tenantId]
    );
    const boq_accepted = boqRes.rows.length > 0;
    const accepted_boq_details = boqRes.rows[0] || null;

    // 2. All revisions closed check: active design review rounds count must be 0
    const reviewRes = await pool.query(
      "SELECT COUNT(*)::int as count FROM design_review_rounds WHERE project_id = $1 AND tenant_id = $2 AND status = 'active'",
      [projectId, tenantId]
    );
    const active_reviews_count = reviewRes.rows[0]?.count || 0;
    const all_revisions_closed = active_reviews_count === 0;

    // 3. Payment schedule agreed check: sum of payment milestones percentages is 100%
    const milestoneRes = await pool.query(
      "SELECT COALESCE(SUM(percentage), 0)::float as total_pct, COALESCE(SUM(amount), 0)::float as total_amt FROM payment_milestones WHERE project_id = $1 AND tenant_id = $2",
      [projectId, tenantId]
    );
    const total_pct = milestoneRes.rows[0]?.total_pct || 0;
    const total_amt = milestoneRes.rows[0]?.total_amt || 0;

    // Check project contract value
    const projRes = await pool.query(
      "SELECT contract_value FROM projects WHERE id = $1 AND tenant_id = $2",
      [projectId, tenantId]
    );
    if (projRes.rows.length === 0) return fail(res, 'NOT_FOUND', 'Project not found', 404);
    const contractVal = Number(projRes.rows[0].contract_value || 0);

    // Schedule is agreed if total percentage is exactly 100%
    // Or if percentage sum is 0 but amount sum matches project contract_value
    const payment_schedule_agreed = Math.abs(total_pct - 100) < 0.01 || (total_pct === 0 && contractVal > 0 && Math.abs(total_amt - contractVal) < 0.01);

    // 4. Overall commercial approval sign-off status
    const approvalRes = await pool.query(
      "SELECT pca.*, u.name as approved_by_name FROM project_commercial_approvals pca LEFT JOIN users u ON pca.approved_by = u.id WHERE pca.project_id = $1 AND pca.tenant_id = $2 LIMIT 1",
      [projectId, tenantId]
    );
    const approval = approvalRes.rows[0] || null;

    return success(res, {
      boq_accepted,
      accepted_boq_details,
      all_revisions_closed,
      active_reviews_count,
      payment_schedule_agreed,
      payment_milestones_total_percentage: total_pct,
      payment_milestones_total_amount: total_amt,
      contract_value: contractVal,
      is_approved: !!approval,
      approval_details: approval
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:id/commercial-approval
router.post('/:id/commercial-approval', authenticate, authorize('projects:manage'), async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const tenantId = req.tenantId;
    const userId = req.user.userId;
    const { notes } = req.body;

    // 1. Recalculate checklist
    const boqRes = await pool.query(
      "SELECT id FROM quotations WHERE project_id = $1 AND tenant_id = $2 AND status = 'accepted' AND accepted_at IS NOT NULL LIMIT 1",
      [projectId, tenantId]
    );
    const boq_accepted = boqRes.rows.length > 0;

    const reviewRes = await pool.query(
      "SELECT COUNT(*)::int as count FROM design_review_rounds WHERE project_id = $1 AND tenant_id = $2 AND status = 'active'",
      [projectId, tenantId]
    );
    const all_revisions_closed = (reviewRes.rows[0]?.count || 0) === 0;

    const milestoneRes = await pool.query(
      "SELECT COALESCE(SUM(percentage), 0)::float as total_pct, COALESCE(SUM(amount), 0)::float as total_amt FROM payment_milestones WHERE project_id = $1 AND tenant_id = $2",
      [projectId, tenantId]
    );
    const total_pct = milestoneRes.rows[0]?.total_pct || 0;
    const total_amt = milestoneRes.rows[0]?.total_amt || 0;

    const projRes = await pool.query(
      "SELECT contract_value FROM projects WHERE id = $1 AND tenant_id = $2",
      [projectId, tenantId]
    );
    if (projRes.rows.length === 0) return fail(res, 'NOT_FOUND', 'Project not found', 404);
    const contractVal = Number(projRes.rows[0].contract_value || 0);

    const payment_schedule_agreed = Math.abs(total_pct - 100) < 0.01 || (total_pct === 0 && contractVal > 0 && Math.abs(total_amt - contractVal) < 0.01);

    const missing = [];
    if (!boq_accepted) missing.push('BOQ acceptance by client');
    if (!all_revisions_closed) missing.push('Closure of active design reviews');
    if (!payment_schedule_agreed) missing.push(`Payment schedule agreement (current total: ${total_pct}% / ${total_amt} of ${contractVal})`);

    if (missing.length > 0) {
      return fail(
        res,
        'COMMERCIAL_GATE_FAILED',
        `Cannot approve commercial sign-off. Pending criteria: ${missing.join(', ')}`,
        400
      );
    }

    // 2. Insert commercial approval record
    const insertRes = await pool.query(
      `INSERT INTO project_commercial_approvals (tenant_id, project_id, approved_by, notes)
       VALUES ($1, $2, $3, $4)
       ON CONFLICT (tenant_id, project_id) 
       DO UPDATE SET approved_by = $3, notes = $4, approved_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [tenantId, projectId, userId, notes || null]
    );

    const approvalRecord = insertRes.rows[0];

    const { logAction } = require('../services/auditLog');
    await logAction({
      tenantId,
      userId,
      action: 'project.commercial_approved',
      entity: 'project',
      entityId: projectId,
      newValue: approvalRecord
    });

    return success(res, approvalRecord, { message: 'Commercial approval sign-off completed successfully.' });
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:id/coordination
router.get('/:id/coordination', authenticate, authorize('projects:read'), async (req, res, next) => {
  try {
    const { getProjectCoordination } = require('../services/projects/coordinationService');
    const data = await getProjectCoordination(req.tenantId, req.params.id);
    return success(res, data);
  } catch (error) {
    next(error);
  }
});



// PATCH /api/projects/:id/coordination
router.patch('/:id/coordination', authenticate, authorize('projects:manage'), validate(coordinationSchema), async (req, res, next) => {
  try {
    const projectId = req.params.id;
    const tenantId = req.tenantId;
    const { siteReadinessDate } = req.body;

    await pool.query(
      'UPDATE projects SET site_readiness_date = $1, updated_at = CURRENT_TIMESTAMP WHERE id = $2 AND tenant_id = $3',
      [siteReadinessDate, projectId, tenantId]
    );

    const { checkAndTriggerCoordinationDelays, getProjectCoordination } = require('../services/projects/coordinationService');
    await checkAndTriggerCoordinationDelays(tenantId, projectId);

    const data = await getProjectCoordination(tenantId, projectId);
    return success(res, data, { message: 'Site readiness date updated successfully.' });
  } catch (error) {
    if (error instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', error.errors, 400);
    next(error);
  }
});

// GET /api/projects/:projectId/external-inspections
router.get('/:projectId/external-inspections', authorize('projects:read'), async (req, res, next) => {
  try {
    const { getExternalInspections } = require('../services/projects/externalInspectionService');
    const data = await getExternalInspections({ tenantId: req.tenantId, projectId: req.params.projectId });
    return success(res, data);
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:projectId/external-inspections
router.post('/:projectId/external-inspections', authorize('projects:write'), async (req, res, next) => {
  try {
    const { createExternalInspection } = require('../services/projects/externalInspectionService');
    const data = await createExternalInspection({ 
      tenantId: req.tenantId, 
      projectId: req.params.projectId, 
      userId: req.userId,
      ...req.body 
    });
    return success(res, data, { message: 'External inspection logged successfully', statusCode: 201 });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/projects/:projectId/external-inspections/:id
router.patch('/:projectId/external-inspections/:id', authorize('projects:write'), async (req, res, next) => {
  try {
    const { updateExternalInspection } = require('../services/projects/externalInspectionService');
    const data = await updateExternalInspection({ 
      tenantId: req.tenantId, 
      projectId: req.params.projectId, 
      id: req.params.id,
      updates: req.body 
    });
    return success(res, data, { message: 'External inspection updated successfully' });
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:projectId/external-inspections/:id
router.delete('/:projectId/external-inspections/:id', authorize('projects:write'), async (req, res, next) => {
  try {
    const { deleteExternalInspection } = require('../services/projects/externalInspectionService');
    await deleteExternalInspection({ 
      tenantId: req.tenantId, 
      projectId: req.params.projectId, 
      id: req.params.id 
    });
    return success(res, null, { message: 'External inspection deleted successfully' });
  } catch (error) {
    next(error);
  }
});


// Project Profitability Routes
const projectProfitabilityController = require('../controllers/projectProfitabilityController');
router.get('/:projectId/profitability', authenticate, projectProfitabilityController.getProjectProfitability);
router.get('/:projectId/ledger', authenticate, projectProfitabilityController.getProjectLedger);

// Project Health Routes
const projectHealthController = require('../controllers/projects/projectHealthController');
router.get('/:projectId/health', authenticate, projectHealthController.getHealthReports);
router.post('/:projectId/health/generate', authenticate, projectHealthController.generateHealthReport);

module.exports = router;
