const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const warrantyService = require('../services/postSale/warrantyService');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createWarrantySchema = z.object({
  productName: z.string().min(1, 'Product name is required'),
  serialNumber: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  brandWarrantyMonths: z.number().int().nonnegative().optional(),
  companyWarrantyMonths: z.number().int().nonnegative().optional(),
  startDate: z.string().regex(dateRegex, 'Start date must be in YYYY-MM-DD format'),
  endDate: z.string().regex(dateRegex, 'End date must be in YYYY-MM-DD format'),
  warrantyDocument: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  handoverItemId: z.string().uuid().optional().nullable()
});

const updateWarrantySchema = z.object({
  productName: z.string().min(1).optional(),
  serialNumber: z.string().optional().nullable(),
  brand: z.string().optional().nullable(),
  brandWarrantyMonths: z.number().int().nonnegative().optional(),
  companyWarrantyMonths: z.number().int().nonnegative().optional(),
  startDate: z.string().regex(dateRegex).optional(),
  endDate: z.string().regex(dateRegex).optional(),
  warrantyDocument: z.string().optional().nullable(),
  status: z.enum(['active', 'voided']).optional(),
  notes: z.string().optional().nullable(),
  handoverItemId: z.string().uuid().optional().nullable()
});

// GET /api/projects/:projectId/warranties
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const warranties = await warrantyService.getWarrantiesByProject(projectId, tenantId);
    return success(res, warranties);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/warranties
router.post('/', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const data = createWarrantySchema.parse(req.body);
    const warranty = await warrantyService.createWarranty({
      tenantId,
      projectId,
      productName: data.productName,
      serialNumber: data.serialNumber,
      brand: data.brand,
      brandWarrantyMonths: data.brandWarrantyMonths,
      companyWarrantyMonths: data.companyWarrantyMonths,
      startDate: data.startDate,
      endDate: data.endDate,
      warrantyDocument: data.warrantyDocument,
      notes: data.notes,
      handoverItemId: data.handoverItemId,
      userId
    });

    return success(res, warranty, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    next(err);
  }
});

// PUT /api/projects/:projectId/warranties/:id
router.put('/:id', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const data = updateWarrantySchema.parse(req.body);
    
    // Map camelCase to snake_case for service
    const updateData = {};
    if (data.productName !== undefined) updateData.product_name = data.productName;
    if (data.serialNumber !== undefined) updateData.serial_number = data.serialNumber;
    if (data.brand !== undefined) updateData.brand = data.brand;
    if (data.brandWarrantyMonths !== undefined) updateData.brand_warranty_months = data.brandWarrantyMonths;
    if (data.companyWarrantyMonths !== undefined) updateData.company_warranty_months = data.companyWarrantyMonths;
    if (data.startDate !== undefined) updateData.start_date = data.startDate;
    if (data.endDate !== undefined) updateData.end_date = data.endDate;
    if (data.warrantyDocument !== undefined) updateData.warranty_document = data.warrantyDocument;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.notes !== undefined) updateData.notes = data.notes;
    if (data.handoverItemId !== undefined) updateData.handover_item_id = data.handoverItemId;

    const warranty = await warrantyService.updateWarranty(id, tenantId, updateData, userId);
    return success(res, warranty);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    if (err.message === 'WARRANTY_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Warranty record not found.', 404);
    }
    next(err);
  }
});

// DELETE /api/projects/:projectId/warranties/:id
router.delete('/:id', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const warranty = await warrantyService.deleteWarranty(id, tenantId, userId);
    return success(res, warranty);
  } catch (err) {
    if (err.message === 'WARRANTY_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Warranty record not found.', 404);
    }
    next(err);
  }
});

module.exports = router;
