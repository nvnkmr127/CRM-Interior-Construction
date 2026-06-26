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

const router = express.Router();

router.use(authenticate);

// Mount nested routes
router.use('/:projectId/phases', phasesRoutes);
router.use('/:projectId/tasks', tasksRoutes);
router.use('/:projectId/documents', documentsRoutes);

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
  property_type: z.string().optional().nullable(),
  property_age: z.string().optional().nullable(),
  renovation_scope: z.string().optional().nullable(),
  segment: z.string().optional().nullable(),
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
  })).optional().nullable()
});

const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.string().optional()
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
    const { checklistId, room, description } = req.body;
    if (!checklistId || !room || !description) return fail(res, 'BAD_REQUEST', 'Missing fields', 400);
    const item = await addItem({ checklistId, room, description });
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

module.exports = router;
