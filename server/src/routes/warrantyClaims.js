const express = require('express');
const { z } = require('zod');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const warrantyClaimService = require('../services/postSale/warrantyClaimService');

const router = express.Router({ mergeParams: true });
router.use(authenticate);

const dateRegex = /^\d{4}-\d{2}-\d{2}$/;

const createClaimSchema = z.object({
  warrantyId: z.string().uuid().optional().nullable(),
  amcId: z.string().uuid().optional().nullable(),
  claimNumber: z.string().min(1, 'Claim number is required'),
  claimDate: z.string().regex(dateRegex, 'Claim date must be in YYYY-MM-DD format').optional(),
  natureOfDefect: z.string().min(1, 'Nature of defect is required')
});

const updateClaimSchema = z.object({
  warrantyId: z.string().uuid().optional().nullable(),
  amcId: z.string().uuid().optional().nullable(),
  claimDate: z.string().regex(dateRegex).optional(),
  natureOfDefect: z.string().min(1).optional(),
  eligibilityDecision: z.enum(['pending', 'approved', 'rejected']).optional(),
  eligibilityReason: z.string().optional().nullable(),
  assignedTechnicianId: z.string().uuid().optional().nullable(),
  status: z.enum(['open', 'in_progress', 'resolved', 'closed']).optional(),
  resolutionDetails: z.string().optional().nullable()
});

// GET /api/projects/:projectId/warranty-claims
router.get('/', authorize('projects:read'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const claims = await warrantyClaimService.getClaimsByProject(projectId, tenantId);
    return success(res, claims);
  } catch (err) {
    next(err);
  }
});

// POST /api/projects/:projectId/warranty-claims
router.post('/', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const data = createClaimSchema.parse(req.body);
    const claim = await warrantyClaimService.createClaim({
      tenantId,
      projectId,
      warrantyId: data.warrantyId,
      amcId: data.amcId,
      claimNumber: data.claimNumber,
      claimDate: data.claimDate,
      natureOfDefect: data.natureOfDefect,
      userId
    });

    return success(res, claim, {}, 201);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    next(err);
  }
});

// PUT /api/projects/:projectId/warranty-claims/:id
router.put('/:id', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const data = updateClaimSchema.parse(req.body);

    const updateData = {};
    if (data.warrantyId !== undefined) updateData.warranty_id = data.warrantyId;
    if (data.amcId !== undefined) updateData.amc_id = data.amcId;
    if (data.claimDate !== undefined) updateData.claim_date = data.claimDate;
    if (data.natureOfDefect !== undefined) updateData.nature_of_defect = data.natureOfDefect;
    if (data.eligibilityDecision !== undefined) updateData.eligibility_decision = data.eligibilityDecision;
    if (data.eligibilityReason !== undefined) updateData.eligibility_reason = data.eligibilityReason;
    if (data.assignedTechnicianId !== undefined) updateData.assigned_technician_id = data.assignedTechnicianId;
    if (data.status !== undefined) updateData.status = data.status;
    if (data.resolutionDetails !== undefined) updateData.resolution_details = data.resolutionDetails;

    const claim = await warrantyClaimService.updateClaim(id, tenantId, updateData, userId);
    return success(res, claim);
  } catch (err) {
    if (err instanceof z.ZodError) {
      return fail(res, 'VALIDATION_ERROR', err.errors, 400);
    }
    if (err.message === 'CLAIM_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Warranty claim not found.', 404);
    }
    next(err);
  }
});

// DELETE /api/projects/:projectId/warranty-claims/:id
router.delete('/:id', authorize('projects:manage'), async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId;
    const userId = req.user.userId;

    const claim = await warrantyClaimService.deleteClaim(id, tenantId, userId);
    return success(res, claim);
  } catch (err) {
    if (err.message === 'CLAIM_NOT_FOUND') {
      return fail(res, 'NOT_FOUND', 'Warranty claim not found.', 404);
    }
    next(err);
  }
});

module.exports = router;
