const express = require('express');
const { z } = require('zod');
const validate = require('../../middleware/validate');
const authenticatePortal = require('../../middleware/authenticatePortal');
const { success } = require('../../utils/response');
const warrantyClaimService = require('../../services/postSale/warrantyClaimService');

const router = express.Router();
router.use(authenticatePortal);

const createPortalClaimSchema = z.object({
  warrantyId: z.string().uuid().optional().nullable(),
  natureOfDefect: z.string().min(1, 'Please describe the defect in detail')
});

// GET /api/portal/warranty-claims
router.get('/', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const claims = await warrantyClaimService.getClaimsByProject(projectId, tenantId);
    return success(res, claims);
  } catch (err) {
    next(err);
  }
});

// POST /api/portal/warranty-claims
router.post('/', validate(createPortalClaimSchema), async (req, res, next) => {
  try {
    const { projectId, tenantId, id: portalUserId } = req.portalUser;

    const data  = req.body;
    const claimNumber = `CLM-${new Date().getFullYear()}-${Math.floor(100000 + Math.random() * 900000)}`;

    const claim = await warrantyClaimService.createClaim({
      tenantId,
      projectId,
      warrantyId: data.warrantyId,
      claimNumber,
      claimDate: new Date().toISOString().split('T')[0],
      natureOfDefect: data.natureOfDefect,
      userId: portalUserId
    });

    return success(res, claim, {}, 201);
  } catch (err) {
    
    next(err);
  }
});

module.exports = router;
