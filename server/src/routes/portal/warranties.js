const express = require('express');
const authenticatePortal = require('../../middleware/authenticatePortal');
const { success } = require('../../utils/response');
const warrantyService = require('../../services/postSale/warrantyService');

const router = express.Router();
router.use(authenticatePortal);

// GET /api/portal/warranties
router.get('/', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const warranties = await warrantyService.getWarrantiesByProject(projectId, tenantId);
    return success(res, warranties);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
