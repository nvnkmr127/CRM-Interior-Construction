const express = require('express');
const { z } = require('zod');
const punchListRepository = require('../repositories/punchListRepository');
const { success, fail } = require('../utils/response');
const validate = require('../middleware/validate');

const router = express.Router({ mergeParams: true });

const createPunchListSchema = z.object({
  title: z.string().min(1, 'Title is required'),
  walkthrough_date: z.string().optional().nullable()
});

const updatePunchListSchema = z.object({
  title: z.string().min(1).optional(),
  walkthrough_date: z.string().optional().nullable(),
  status: z.enum(['draft', 'active', 'resolved', 'client_verified']).optional()
});

const createItemSchema = z.object({
  room_name: z.string().min(1, 'Room name is required'),
  trade: z.string().min(1, 'Trade is required'),
  item_description: z.string().min(1, 'Item description is required'),
  photo_key: z.string().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable()
});

const updateItemSchema = z.object({
  room_name: z.string().min(1).optional(),
  trade: z.string().min(1).optional(),
  item_description: z.string().min(1).optional(),
  photo_key: z.string().optional().nullable(),
  assignee_id: z.string().uuid().optional().nullable(),
  status: z.enum(['open', 'resolved', 'verified']).optional(),
  qc_notes: z.string().optional().nullable()
});

// GET /api/projects/:projectId/punch-lists
router.get('/', async (req, res, next) => {
  try {
    const list = await punchListRepository.getPunchLists(req.tenantId, req.params.projectId);
    return success(res, list);
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:projectId/punch-lists
router.post('/', validate(createPunchListSchema), async (req, res, next) => {
  try {
    const data = req.body;
    const pl = await punchListRepository.createPunchList(
      req.tenantId,
      req.params.projectId,
      data,
      req.user?.userId
    );
    return success(res, pl, {}, 201);
  } catch (error) {
    next(error);
  }
});

// GET /api/projects/:projectId/punch-lists/:id
router.get('/:id', async (req, res, next) => {
  try {
    const pl = await punchListRepository.getPunchListById(req.tenantId, req.params.id);
    if (!pl) return fail(res, 'NOT_FOUND', 'Punch list not found', 404);
    return success(res, pl);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/projects/:projectId/punch-lists/:id
router.patch('/:id', validate(updatePunchListSchema), async (req, res, next) => {
  try {
    const updates = req.body;
    const pl = await punchListRepository.updatePunchList(req.tenantId, req.params.id, updates);
    if (!pl) return fail(res, 'NOT_FOUND', 'Punch list not found', 404);
    return success(res, pl);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:projectId/punch-lists/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const ok = await punchListRepository.deletePunchList(req.tenantId, req.params.id);
    if (!ok) return fail(res, 'NOT_FOUND', 'Punch list not found', 404);
    return success(res, { deleted: true });
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:projectId/punch-lists/:id/items
router.post('/:id/items', validate(createItemSchema), async (req, res, next) => {
  try {
    const itemData = req.body;
    const item = await punchListRepository.createPunchListItem(req.tenantId, req.params.id, itemData);
    return success(res, item, {}, 201);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/projects/:projectId/punch-lists/:id/items/:itemId
router.patch('/:id/items/:itemId', validate(updateItemSchema), async (req, res, next) => {
  try {
    const updates = req.body;
    const item = await punchListRepository.updatePunchListItem(
      req.tenantId,
      req.params.itemId,
      updates,
      req.user?.userId
    );
    return success(res, item);
  } catch (error) {
    if (error.status === 400) return fail(res, error.code || 'BAD_REQUEST', error.message, 400);
    next(error);
  }
});

// DELETE /api/projects/:projectId/punch-lists/:id/items/:itemId
router.delete('/:id/items/:itemId', async (req, res, next) => {
  try {
    const ok = await punchListRepository.deletePunchListItem(req.tenantId, req.params.itemId);
    if (!ok) return fail(res, 'NOT_FOUND', 'Punch list item not found', 404);
    return success(res, { deleted: true });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
