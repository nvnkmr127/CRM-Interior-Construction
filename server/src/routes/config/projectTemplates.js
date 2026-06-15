const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../../utils/response');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  getTemplates,
  createTemplate,
  updateTemplate
} = require('../../services/config/templateService');
const pool = require('../../db/pool');

const router = express.Router();

router.use(authenticate, authorize('config:manage'));

router.get('/', async (req, res, next) => {
  try {
    const templates = await getTemplates(req.tenantId);
    return success(res, templates);
  } catch (error) {
    next(error);
  }
});

const createSchema = z.object({
  name: z.string().min(1),
  project_type: z.string().optional(),
  description: z.string().optional(),
  phases: z.array(z.any()).optional()
});

router.post('/', async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.isValidation = true;
      err.details = parsed.error.issues;
      return next(err);
    }

    const template = await createTemplate(req.tenantId, req.user.id, parsed.data);
    return success(res, template, {}, 201);
  } catch (error) {
    next(error);
  }
});

const updateSchema = z.object({
  name: z.string().min(1).optional(),
  project_type: z.string().optional(),
  description: z.string().optional(),
  phases: z.array(z.any()).optional(),
  is_active: z.boolean().optional()
});

router.put('/:id', async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.isValidation = true;
      err.details = parsed.error.issues;
      return next(err);
    }

    const template = await updateTemplate(req.tenantId, req.params.id, parsed.data);
    return success(res, template);
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Template not found', 404);
    }
    next(error);
  }
});

router.delete('/:id', async (req, res, next) => {
  try {
    // Soft delete bypass
    const query = `
      UPDATE project_templates
      SET is_active = false
      WHERE id = $2 AND tenant_id = $1
    `;
    await pool.query(query, [req.tenantId, req.params.id]);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
