const express = require('express');
const { z } = require('zod');
const { success, fail, paginate } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
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


const router = express.Router();

router.use(authenticate);

// Mount nested routes
router.use('/:projectId/phases', phasesRoutes);
router.use('/:projectId/tasks', tasksRoutes);
router.use('/:projectId/documents', documentsRoutes);
router.use('/:projectId/design-assets', designAssetsRoutes);
router.use('/:projectId/design-reviews', designReviewsRoutes);
router.use('/:projectId/material-palettes', materialPalettesRoutes);
router.use('/:projectId/change-orders', changeOrdersRoutes);
router.use('/:projectId/quotations', quotationsRoutes);
router.use('/:projectId/budget', budgetRoutes);
router.use('/:projectId/purchase-orders', purchaseOrdersRoutes);
router.use('/:projectId/material-deliveries', materialDeliveriesRoutes);
router.use('/:projectId/vendor-payments', vendorPaymentsRoutes);
router.use('/:projectId/material-substitutions', materialSubstitutionsRoutes);
router.use('/:projectId/production-orders', productionOrdersRoutes);
router.use('/:projectId/work-activities', workActivitiesRoutes);
router.use('/:projectId/site-readiness', siteReadinessRoutes);
router.use('/:projectId/task-dependencies', taskDependenciesRoutes);
router.use('/:projectId/daily-reports', dailySiteReportsRoutes);
router.use('/:projectId/room-progress', roomProgressRoutes);
router.use('/:projectId/meeting-notes', meetingNotesRoutes);
router.use('/:projectId/delay-notifications', delayNotificationsRoutes);
router.use('/:projectId/drawing-register', drawingRegisterRoutes);
router.use('/:projectId/punch-lists', punchListsRoutes);
router.use('/:projectId/warranties', warrantiesRoutes);
router.use('/:projectId/amcs', amcsRoutes);
router.use('/:projectId/warranty-claims', warrantyClaimsRoutes);
router.use('/:projectId/closure-checklist', projectClosuresRoutes);
router.use('/:projectId/retrospective', projectRetrospectivesRoutes);



// Standard CRUD routes

const createProjectSchema = z.object({
  client_name: z.string().min(2, 'Client name must be at least 2 characters'),
  name: z.string().min(1, 'Project name is required'),
  project_type: z.string().optional(),
  pm_id: z.string().uuid().optional().nullable(),
  designer_id: z.string().uuid().optional().nullable(),
  contract_value: z.number().optional().nullable(),
  booking_amount: z.number().optional().nullable(),
  start_date: z.string().optional().nullable(),
  target_date: z.string().optional().nullable(),
  site_address: z.string().optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  client_phone: z.string().optional().nullable(),
  client_email: z.string().email().optional().nullable(),
  contract_file_key: z.string({ required_error: 'Contract file key is required' }).min(1, 'Contract file key is required'),
  contract_file_name: z.string({ required_error: 'Contract file name is required' }).min(1, 'Contract file name is required'),
  contract_file_size: z.number({ required_error: 'Contract file size is required' }).positive('Contract file size must be positive'),
  contract_file_mime: z.string({ required_error: 'Contract file mime type is required' }).min(1, 'Contract file mime type is required'),
  is_scope_locked: z.boolean().optional(),
  enforce_dependencies: z.boolean().optional(),
  agreement_signed_by: z.string().optional().nullable(),
  agreement_signed_at: z.string().optional().nullable(),
  agreement_signature_method: z.string().optional().nullable(),
  payment_terms: z.string().optional().nullable(),
  flat_number: z.string().optional().nullable(),
  floor: z.string().optional().nullable(),
  building_name: z.string().optional().nullable(),
  street: z.string().optional().nullable(),
  city: z.string().optional().nullable(),
  pincode: z.string().optional().nullable(),
  landmark: z.string().optional().nullable(),
  latitude: z.number().optional().nullable(),
  longitude: z.number().optional().nullable(),
  builder_name: z.string().optional().nullable(),
  society_name: z.string().optional().nullable(),
  rera_id: z.string().optional().nullable(),
  noc_status: z.string().optional().nullable(),
  occupancy_certificate_status: z.string().optional().nullable(),
  property_handover_date: z.string().optional().nullable(),
  contacts: z.array(z.object({
    name: z.string().min(1, 'Contact name is required'),
    phone: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    role: z.string().optional().nullable(),
    decision_authority: z.string().optional().nullable(),
    relationship_notes: z.string().optional().nullable()
  })).optional().nullable(),
  carpet_area: z.number().optional().nullable(),
  built_up_area: z.number().optional().nullable(),
  number_of_rooms: z.number().int().optional().nullable(),
  project_category: z.string().optional().nullable(),
  project_sub_category: z.string().optional().nullable(),
  fire_noc_status: z.string().optional().nullable(),
  occupancy_permit_status: z.string().optional().nullable(),
  retention_money_percentage: z.number().optional().nullable(),
  ld_clause_details: z.string().optional().nullable(),
  stakeholder_complexity: z.string().optional().nullable(),
  property_type: z.string().optional().nullable(),
  property_age: z.string().optional().nullable(),
  renovation_scope: z.string().optional().nullable(),
  segment: z.string().optional().nullable(),
  allowed_design_revisions: z.number().int().nonnegative().optional().nullable(),
  current_design_revisions: z.number().int().nonnegative().optional().nullable(),
  pm_hours_allocated: z.number().int().nonnegative().optional().nullable(),
  designer_hours_allocated: z.number().int().nonnegative().optional().nullable(),
  measurements: z.array(z.object({
    room_name: z.string().min(1, 'Room name is required'),
    length: z.number().optional().nullable(),
    width: z.number().optional().nullable(),
    height: z.number().optional().nullable(),
    area: z.number().optional().nullable(),
    unit: z.string().optional().nullable(),
    notes: z.string().optional().nullable()
  })).optional().nullable(),
  vendors: z.array(z.object({
    vendor_name: z.string().min(1, 'Vendor name is required'),
    scope_of_work: z.string().optional().nullable(),
    agreed_rate: z.number().optional().nullable(),
    payment_terms: z.string().optional().nullable(),
    status: z.string().optional().nullable()
  })).optional().nullable(),
  consultants: z.array(z.object({
    name: z.string().min(1, 'Consultant name is required'),
    role: z.string().min(1, 'Consultant role is required'),
    firm: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    phone: z.string().optional().nullable()
  })).optional().nullable(),
  site_team: z.array(z.object({
    vendor_id: z.string().uuid().optional().nullable(),
    role: z.string().min(1, 'Role is required'),
    name: z.string().min(1, 'Name is required'),
    phone: z.string().optional().nullable(),
    email: z.string().optional().nullable(),
    status: z.string().optional().nullable()
  })).optional().nullable()
});

const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.string().optional(),
  changeReason: z.string().optional()
});

// Route to generate S3 pre-signed upload URL for contract document
router.post('/contract/upload-url', authorize('projects:create'), async (req, res, next) => {
  try {
    const { name, mimeType } = z.object({
      name: z.string().min(1, 'File name is required'),
      mimeType: z.string().min(1, 'Mime type is required')
    }).parse(req.body);

    const { getUploadUrl } = require('../services/documents/documentService');
    const result = await getUploadUrl({
      tenantId: req.tenantId,
      projectId: 'temp',
      name,
      mimeType
    });
    return success(res, result);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    console.error('[Projects Router] contract upload-url error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to generate contract upload URL.', 500);
  }
});

router.post('/', authorize('projects:create'), async (req, res, next) => {
  try {
    const data = createProjectSchema.parse(req.body);
    const project = await createProject({
      tenantId: req.tenantId,
      userId: req.user.userId,
      data
    });
    return success(res, project, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    console.error('[Projects Router] Create error:', err);
    return fail(res, 'INTERNAL_ERROR', 'An error occurred while creating the project.', 500);
  }
});

// GET /api/projects
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const { status, pmId, designerId, search, page, limit } = req.query;
    
    const parsedPage = parseInt(page, 10) || 1;
    const parsedLimit = parseInt(limit, 10) || 20;

    const result = await projectRepository.findProjects(req.tenantId, {
      status,
      pmId,
      designerId,
      search,
      page: parsedPage,
      limit: parsedLimit
    });

    return paginate(res, result.data, result.total, result.page, result.limit);
  } catch (err) {
    console.error('[Projects Router] List error:', err);
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
  } catch (err) {
    next(err);
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
  } catch (err) {
    next(err);
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
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/referrals/:id
router.patch('/referrals/:id', authorize('projects:update'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      referralStatus: z.enum(['pending', 'converted', 'closed']).optional(),
      rewardStatus: z.enum(['unpaid', 'paid', 'not_eligible']).optional(),
      rewardAmount: z.number().optional(),
      notes: z.string().optional().nullable()
    });

    const data = schema.parse(req.body);

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
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    next(err);
  }
});

// GET /api/projects/:projectId/boq-variance
router.get('/:projectId/boq-variance', authorize('projects:read'), require('../controllers/boqVarianceController').getProjectBOQVarianceReport);

// GET /api/projects/:id
router.get('/:id', authorize('projects:read'), async (req, res, next) => {
  try {
    const project = await projectRepository.findProjectById(req.tenantId, req.params.id);
    if (!project) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }

    const stats = await projectRepository.getProjectStats(req.tenantId, req.params.id);
    
    return success(res, { ...project, stats });
  } catch (err) {
    console.error('[Projects Router] Get by ID error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to retrieve project details.', 500);
  }
});

// PATCH /api/projects/:id
router.patch('/:id', authorize('projects:update'), async (req, res, next) => {
  try {
    const data = updateProjectSchema.parse(req.body);
    const updatedProject = await updateProject({
      tenantId: req.tenantId,
      userId: req.user.userId,
      projectId: req.params.id,
      data
    });
    return success(res, updatedProject);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    if (err.message === 'BOOKING_PAYMENT_REQUIRED' || err.status === 400) {
      return fail(res, 'BOOKING_PAYMENT_REQUIRED', err.message, 400);
    }
    if (err.message === 'NOT_FOUND' || err.status === 404) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    console.error('[Projects Router] Update error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update project.', 500);
  }
});

// DELETE /api/projects/:id
router.delete('/:id', authorize('projects:delete'), async (req, res, next) => {
  try {
    await projectRepository.softDeleteProject(req.tenantId, req.params.id);
    return res.status(204).send();
  } catch (err) {
    if (err.message === 'NOT_FOUND' || err.status === 404) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    console.error('[Projects Router] Delete error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete project.', 500);
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
  } catch (err) {
    if (err.message === 'PROJECT_NOT_FOUND' || err.status === 404) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    console.error('[Projects Router] Archive error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to archive project.', 500);
  }
});

// POST /api/projects/:id/reopen
router.post('/:id/reopen', authorize('projects:update'), async (req, res, next) => {
  try {
    const { newStartDate, newTargetDate } = z.object({
      newStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Start date must be in YYYY-MM-DD format'),
      newTargetDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Target date must be in YYYY-MM-DD format').optional().nullable()
    }).parse(req.body);

    const { reopenProject } = require('../services/projects/reopenProject');
    const project = await reopenProject({
      projectId: req.params.id,
      tenantId: req.tenantId,
      userId: req.user.userId,
      newStartDate,
      newTargetDate
    });
    return success(res, project, { message: 'Project reopened successfully.' });
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    if (err.message === 'PROJECT_NOT_FOUND' || err.status === 404) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    if (err.message === 'PROJECT_ALREADY_ACTIVE' || err.status === 400) {
      return fail(res, 'BAD_REQUEST', err.message, 400);
    }
    console.error('[Projects Router] Reopen error:', err);
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
  } catch (err) {
    console.error('[Projects Router] Get Payment Milestones error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to retrieve payment milestones.', 500);
  }
});

// GET /api/projects/:id/handover/checklists
router.get('/:id/handover/checklists', authorize('projects:read'), async (req, res, next) => {
  try {
    const checklist = await getChecklistByProjectId(req.params.id, req.tenantId);
    if (!checklist) return fail(res, 'NOT_FOUND', 'Checklist not found', 404);
    return success(res, checklist);
  } catch (err) {
    next(err);
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
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/handover/items
router.post('/:id/handover/items', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { checklistId, room, description, itemType } = req.body;
    if (!checklistId || !room || !description) return fail(res, 'BAD_REQUEST', 'Missing fields', 400);
    const item = await addItem({ checklistId, room, description, itemType });
    return success(res, item, {}, 201);
  } catch (err) {
    next(err);
  }
});

const applySchema = z.object({
  templateId: z.string().uuid()
});

router.post('/:id/apply-template', authorize('projects:manage'), async (req, res, next) => {
  try {
    const parsed = applySchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.isValidation = true;
      err.details = parsed.error.issues;
      return next(err);
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

const designRequirementsSchema = z.object({
  interior_style: z.string().optional().nullable(),
  color_theme: z.string().optional().nullable(),
  material_preference: z.string().optional().nullable(),
  kitchen_style: z.string().optional().nullable(),
  wardrobe_style: z.string().optional().nullable(),
  lighting_preference: z.string().optional().nullable(),
  flooring_preference: z.string().optional().nullable(),
  lifestyle_inputs: z.string().optional().nullable(),
  must_haves: z.string().optional().nullable(),
  nice_to_haves: z.string().optional().nullable()
});

const roomRequirementSchema = z.object({
  room_name: z.string().min(1, 'Room name is required'),
  budget_allocation: z.number().optional().nullable(),
  priority: z.string().optional().nullable(),
  functional_requirements: z.string().optional().nullable(),
  remarks: z.string().optional().nullable()
});

const inspirationSchema = z.object({
  image_url: z.string().min(1, 'Image URL is required'),
  room_type: z.string().optional().nullable(),
  notes: z.string().optional().nullable()
});

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
        nice_to_haves: ''
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
  } catch (err) {
    next(err);
  }
});

// PUT /api/projects/:projectId/design-requirements
router.put('/:projectId/design-requirements', authorize('projects:update'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const data = designRequirementsSchema.parse(req.body);
    
    const query = `
      INSERT INTO project_design_requirements (
        tenant_id, project_id, interior_style, color_theme, material_preference,
        kitchen_style, wardrobe_style, lighting_preference, flooring_preference,
        lifestyle_inputs, must_haves, nice_to_haves
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
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
      data.nice_to_haves || null
    ];
    
    const { rows } = await pool.query(query, values);
    return success(res, rows[0]);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    next(err);
  }
});

// POST /api/projects/:projectId/room-requirements
router.post('/:projectId/room-requirements', authorize('projects:update'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const data = roomRequirementSchema.parse(req.body);
    
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
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    next(err);
  }
});

// PUT /api/projects/:projectId/room-requirements/:id
router.put('/:projectId/room-requirements/:id', authorize('projects:update'), async (req, res, next) => {
  try {
    const { projectId, id } = req.params;
    const data = roomRequirementSchema.parse(req.body);
    
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
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    next(err);
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
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/inspirations
router.post('/:projectId/inspirations', authorize('projects:update'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const data = inspirationSchema.parse(req.body);
    
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
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    next(err);
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
  } catch (err) {
    next(err);
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
  } catch (err) {
    console.error('[Projects Router] Fetch schedule revisions error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch schedule revisions.', 500);
  }
});

// POST /api/projects/:projectId/replace-resource
router.post('/:projectId/replace-resource', authorize('projects:update'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const { replaceResource } = require('../services/projects/replaceResourceService');
    
    const schema = z.object({
      role: z.enum(['pm', 'designer']),
      newResourceId: z.string().uuid(),
      handoverNotes: z.string().min(1, 'Handover notes are required'),
      clientNotified: z.boolean().optional().default(false)
    });
    
    const data = schema.parse(req.body);
    
    const handover = await replaceResource({
      tenantId: req.tenantId,
      userId: req.userId,
      projectId,
      role: data.role,
      newResourceId: data.newResourceId,
      handoverNotes: data.handoverNotes
    });
    
    return success(res, handover, {}, 200);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    if (err.status) return fail(res, err.message, err.message, err.status);
    next(err);
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
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:id/pause
router.post('/:id/pause', authorize('projects:update'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      reason: z.string().min(1, 'Reason is required'),
      expectedResumeDate: z.string().optional().nullable(),
      clientCommunication: z.object({
        channel: z.enum(['whatsapp', 'email', 'sms', 'call']),
        direction: z.enum(['inbound', 'outbound']).optional(),
        subject: z.string().optional().nullable(),
        body: z.string().min(1, 'Body is required')
      }).optional().nullable()
    });

    const { reason, expectedResumeDate, clientCommunication } = schema.parse(req.body);
    const { pauseProject } = require('../services/projects/pauseProject');

    const project = await pauseProject({
      projectId: id,
      tenantId: req.tenantId,
      userId: req.user.userId,
      reason,
      expectedResumeDate,
      clientCommunication
    });

    return success(res, project, { message: 'Project paused successfully.' });
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    if (err.status) return fail(res, err.message, err.message, err.status);
    next(err);
  }
});

// POST /api/projects/:id/resume
router.post('/:id/resume', authorize('projects:update'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { resumeProject } = require('../services/projects/pauseProject');

    const project = await resumeProject({
      projectId: id,
      tenantId: req.tenantId,
      userId: req.user.userId
    });

    return success(res, project, { message: 'Project resumed successfully.' });
  } catch (err) {
    if (err.status) return fail(res, err.message, err.message, err.status);
    next(err);
  }
});

// POST /api/projects/:id/cancel
router.post('/:id/cancel', authorize('projects:update'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const schema = z.object({
      reason: z.string().min(1, 'Reason is required'),
      settlementNotes: z.string().optional().nullable(),
      refundOverride: z.number().optional().nullable(),
      recoverOverride: z.number().optional().nullable()
    });

    const { reason, settlementNotes, refundOverride, recoverOverride } = schema.parse(req.body);
    const { cancelProject } = require('../services/projects/cancelProject');

    const project = await cancelProject({
      projectId: id,
      tenantId: req.tenantId,
      userId: req.user.userId,
      reason,
      settlementNotes,
      refundOverride,
      recoverOverride
    });

    return success(res, project, { message: 'Project cancelled successfully and settlement calculated.' });
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    if (err.status) return fail(res, err.message, err.message, err.status);
    next(err);
  }
});

// POST /api/projects/:id/cancel/acknowledge
router.post('/:id/cancel/acknowledge', authorize('projects:update'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const { acknowledgeCancellation } = require('../services/projects/cancelProject');

    const project = await acknowledgeCancellation({
      projectId: id,
      tenantId: req.tenantId,
      userId: req.user.userId
    });

    return success(res, project, { message: 'Project cancellation settlement acknowledged successfully.' });
  } catch (err) {
    if (err.status) return fail(res, err.message, err.message, err.status);
    next(err);
  }
});

// POST /api/projects/:projectId/boq-items/:itemId/discontinue
router.post('/:projectId/boq-items/:itemId/discontinue', authorize('projects:update'), async (req, res, next) => {
  try {
    const { projectId, itemId } = req.params;
    
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
  } catch (err) {
    next(err);
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
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/room-handovers/sign-off
router.post('/:projectId/room-handovers/sign-off', authorize('projects:update'), async (req, res, next) => {
  const client = await pool.connect();
  try {
    const { projectId } = req.params;
    const schema = z.object({
      checklistId: z.string().uuid(),
      roomName: z.string().min(1),
      clientName: z.string().min(1),
      clientSignatureData: z.string().optional().nullable(),
      otp: z.string().min(4)
    });

    const { checklistId, roomName, clientName, clientSignatureData, otp } = schema.parse(req.body);

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
  } catch (err) {
    await client.query('ROLLBACK');
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    next(err);
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
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:projectId/compliance/:itemId
router.patch('/:projectId/compliance/:itemId', authorize('projects:update'), async (req, res, next) => {
  try {
    const { projectId, itemId } = req.params;
    const schema = z.object({
      status: z.enum(['pending', 'in_progress', 'approved', 'not_applicable']),
      notes: z.string().optional().nullable()
    });

    const { status, notes } = schema.parse(req.body);

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
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    next(err);
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
         current_status 
       FROM project_vendors 
       WHERE project_id = $1 AND tenant_id = $2
       ORDER BY scheduled_start_date ASC, created_at ASC`,
      [projectId, req.tenantId]
    );
    return success(res, rows);
  } catch (err) {
    next(err);
  }
});

// PATCH /api/projects/:projectId/vendor-coordination/:vendorId
router.patch('/:projectId/vendor-coordination/:vendorId', authorize('projects:update'), async (req, res, next) => {
  try {
    const { projectId, vendorId } = req.params;
    const schema = z.object({
      scheduledStartDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
      scheduledFinishDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).optional().nullable(),
      blockerDescription: z.string().optional().nullable(),
      currentStatus: z.enum(['pending', 'active', 'blocked', 'completed']).optional()
    });

    const data = schema.parse(req.body);

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
      newValue: rows[0]
    });

    return success(res, rows[0]);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    next(err);
  }
});

module.exports = router;
