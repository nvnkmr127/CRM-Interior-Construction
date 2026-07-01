const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const pool = require('../db/pool');
const { updateItem, clientSignOff } = require('../services/postSale/handoverService');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// PATCH /api/handover/items/:itemId
const updateItemSchema = z.object({
  checklistId: z.string().uuid(),
  is_checked: z.boolean().optional(),
  photo_key: z.string().optional().nullable(),
  serial_number: z.string().optional().nullable(),
  warranty_expiry_date: z.string().optional().nullable(),
  has_manual: z.boolean().optional(),
  has_warranty_card: z.boolean().optional(),
  key_details: z.string().optional().nullable()
});

router.patch('/items/:itemId', authorize('handover:authorize'), async (req, res, next) => {
  try {
    const data = updateItemSchema.parse(req.body);
    const item = await updateItem({
      checklistId: data.checklistId,
      itemId: req.params.itemId,
      isChecked: data.is_checked,
      photoKey: data.photo_key,
      userId: req.user.userId,
      serialNumber: data.serial_number,
      warrantyExpiryDate: data.warranty_expiry_date,
      hasManual: data.has_manual,
      hasWarrantyCard: data.has_warranty_card,
      keyDetails: data.key_details,
      hasBrandRegistrationCard: data.has_brand_registration_card
    });
    return success(res, item);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    next(err);
  }
});

// POST /api/handover/checklists/:id/authorize
router.post('/checklists/:id/authorize', authorize('handover:authorize'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const checkRes = await pool.query(
      'SELECT id FROM handover_checklists WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );
    if (checkRes.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Handover checklist not found', 404);
    }

    const { rows } = await pool.query(
      `UPDATE handover_checklists 
       SET is_internally_authorized = TRUE,
           internally_authorized_by = $1,
           internally_authorized_at = CURRENT_TIMESTAMP
       WHERE id = $2 AND tenant_id = $3
       RETURNING *`,
      [userId, id, tenantId]
    );

    return success(res, rows[0], { message: 'Handover internally authorized successfully.' });
  } catch (err) {
    next(err);
  }
});

// POST /api/handover/checklists/:id/sign-off
router.post('/checklists/:id/sign-off', authorize('handover:authorize'), async (req, res, next) => {
  try {
    const checklist = await clientSignOff({
      checklistId: req.params.id,
      tenantId: req.tenantId,
      clientPortalUserId: req.user.userId
    });
    return success(res, checklist);
  } catch (err) {
    if (err.message === 'ITEMS_INCOMPLETE') {
      return fail(res, 'BAD_REQUEST', 'All items must be checked before sign-off', 400);
    }
    if (err.message === 'INTERNAL_AUTHORIZATION_PENDING') {
      return fail(res, 'BAD_REQUEST', 'Internal Authorization Pending: Operations head or senior PM must authorize the handover before client sign-off.', 400);
    }
    next(err);
  }
});

module.exports = router;
