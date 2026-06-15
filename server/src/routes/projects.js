const express = require('express');
const { z } = require('zod');
const { success, fail, paginate } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { applyTemplate } = require('../services/config/templateService');
const { createProject } = require('../services/projects/createProject');
const { updateProject } = require('../services/projects/updateProject');
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
  start_date: z.string().optional().nullable(),
  target_date: z.string().optional().nullable(),
  site_address: z.string().optional().nullable(),
  templateId: z.string().uuid().optional().nullable(),
  client_phone: z.string().optional().nullable(),
  client_email: z.string().email().optional().nullable()
});

const updateProjectSchema = createProjectSchema.partial().extend({
  status: z.string().optional()
});

router.post('/', authorize('projects:create'), async (req, res, next) => {
  try {
    const data = createProjectSchema.parse(req.body);
    const project = await createProject({
      tenantId: req.tenantId,
      userId: req.user.userId,
      data
    });
    return success(res, project, 201);
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
    return success(res, updatedProject, 200);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    if (err.message === 'NOT_FOUND' || err.status === 404) {
      return fail(res, 'NOT_FOUND', 'Project not found', 404);
    }
    console.error('[Projects Router] Update error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update project.', 500);
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

module.exports = router;
