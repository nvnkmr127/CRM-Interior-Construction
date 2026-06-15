const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { updateItem, clientSignOff } = require('../services/postSale/handoverService');

const router = express.Router();

router.use(authenticate);

// PATCH /api/handover/items/:itemId
const updateItemSchema = z.object({
  checklistId: z.string().uuid(),
  is_checked: z.boolean().optional(),
  photo_key: z.string().optional().nullable()
});

router.patch('/items/:itemId', authorize('projects:manage'), async (req, res, next) => {
  try {
    const data = updateItemSchema.parse(req.body);
    const item = await updateItem({
      checklistId: data.checklistId,
      itemId: req.params.itemId,
      isChecked: data.is_checked,
      photoKey: data.photo_key,
      userId: req.user.userId
    });
    return success(res, item);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    next(err);
  }
});

// POST /api/handover/checklists/:id/sign-off
router.post('/checklists/:id/sign-off', authorize('projects:manage'), async (req, res, next) => {
  try {
    const checklist = await clientSignOff({
      checklistId: req.params.id,
      tenantId: req.tenantId,
      clientPortalUserId: req.user.userId // Typically client sign off is done by client portal user, but for now staff can trigger it or we use their userId.
    });
    return success(res, checklist);
  } catch (err) {
    if (err.message === 'ITEMS_INCOMPLETE') {
      return fail(res, 'BAD_REQUEST', 'All items must be checked before sign-off', 400);
    }
    next(err);
  }
});

module.exports = router;
