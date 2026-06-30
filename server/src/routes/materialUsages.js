const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const materialUsageRepository = require('../repositories/materialUsageRepository');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const logUsageSchema = z.object({
  poItemId: z.string().uuid().optional().nullable(),
  boqItemId: z.string().uuid().optional().nullable(),
  activityName: z.string().min(1, 'Activity name is required'),
  materialName: z.string().optional().nullable(),
  quantityUsed: z.number().positive('Quantity must be greater than zero'),
  unit: z.string().optional().nullable(),
  dateUsed: z.string().regex(/^\d{4}-\d{2}-\d{2}$/, 'Invalid date format (YYYY-MM-DD)').optional(),
  notes: z.string().optional().nullable()
});

// POST /api/projects/:projectId/material-usages
router.post('/', authorize('projects:manage'), async (req, res) => {
  try {
    const data = logUsageSchema.parse(req.body);
    const mappedData = {
      po_item_id: data.poItemId,
      boq_item_id: data.boqItemId,
      activity_name: data.activityName,
      material_name: data.materialName,
      quantity_used: data.quantityUsed,
      unit: data.unit,
      date_used: data.dateUsed || new Date().toISOString().split('T')[0],
      notes: data.notes
    };

    const usageLog = await materialUsageRepository.logUsage(
      req.tenantId,
      req.params.projectId,
      req.user?.userId,
      mappedData
    );

    return success(res, usageLog, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) return fail(res, 'VALIDATION_ERROR', err.errors || err.issues, 400);
    console.error('[MaterialUsage Router] Log usage error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to log material usage.', 500);
  }
});

// GET /api/projects/:projectId/material-usages
router.get('/', authorize('projects:read'), async (req, res) => {
  try {
    const usages = await materialUsageRepository.findUsagesByProject(
      req.tenantId,
      req.params.projectId
    );
    return success(res, usages);
  } catch (err) {
    console.error('[MaterialUsage Router] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch material usages.', 500);
  }
});

// GET /api/projects/:projectId/material-stock
router.get('/stock', authorize('projects:read'), async (req, res) => {
  try {
    const stock = await materialUsageRepository.getRemainingSiteStock(
      req.tenantId,
      req.params.projectId
    );
    return success(res, stock);
  } catch (err) {
    console.error('[MaterialUsage Router] Stock calculate error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to calculate remaining site stock.', 500);
  }
});

module.exports = router;
