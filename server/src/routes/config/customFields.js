const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../../utils/response');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const {
  getFields,
  addField,
  updateField,
  deleteField
} = require('../../services/config/customFieldsService');

const router = express.Router();

// Apply auth to all routes in this module
router.use(authenticate);

router.get('/', async (req, res, next) => {
  try {
    const { entity } = req.query;
    if (!entity) {
      return fail(res, 'VALIDATION_ERROR', 'entity query parameter is required', 400);
    }
    const fields = await getFields(req.tenantId, entity);
    return success(res, fields);
  } catch (error) {
    next(error);
  }
});

const createSchema = z.object({
  entity: z.enum(['lead', 'project', 'task', 'contact']),
  name: z.string().min(1),
  label: z.string().min(1),
  field_type: z.enum(['text', 'number', 'date', 'dropdown', 'multi_select', 'file', 'boolean']),
  options: z.array(z.string()).optional(),
  is_required: z.boolean().optional(),
  sort_order: z.number().optional()
});

router.post('/', authorize('config:manage'), async (req, res, next) => {
  try {
    const parsed = createSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.isValidation = true;
      err.details = parsed.error.issues;
      return next(err);
    }

    const field = await addField(req.tenantId, parsed.data);
    return success(res, field, {}, 201);
  } catch (error) {
    if (error.code === '23505') { // Postgres unique violation code
      return fail(res, 'CONFLICT', 'A custom field with this name already exists for this entity.', 409);
    }
    next(error);
  }
});

const updateSchema = z.object({
  label: z.string().min(1).optional(),
  options: z.array(z.string()).optional(),
  is_required: z.boolean().optional(),
  sort_order: z.number().optional(),
  is_active: z.boolean().optional()
});

router.put('/:id', authorize('config:manage'), async (req, res, next) => {
  try {
    const parsed = updateSchema.safeParse(req.body);
    if (!parsed.success) {
      const err = new Error('Validation failed');
      err.isValidation = true;
      err.details = parsed.error.issues;
      return next(err);
    }

    const field = await updateField(req.tenantId, req.params.id, parsed.data);
    return success(res, field);
  } catch (error) {
    if (error.message === 'NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Custom field not found', 404);
    }
    next(error);
  }
});

router.delete('/:id', authorize('config:manage'), async (req, res, next) => {
  try {
    await deleteField(req.tenantId, req.params.id);
    return res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
