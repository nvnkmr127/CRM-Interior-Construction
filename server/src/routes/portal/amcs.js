const express = require('express');
const authenticatePortal = require('../../middleware/authenticatePortal');
const { success } = require('../../utils/response');
const amcService = require('../../services/postSale/amcService');

const router = express.Router();
router.use(authenticatePortal);

// GET /api/portal/amcs
router.get('/', async (req, res, next) => {
  try {
    const { projectId, tenantId } = req.portalUser;
    const amcs = await amcService.getAmcsByProject(projectId, tenantId);
    return success(res, amcs);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
