const express = require('express');
const { getSnags, updateSnagStatus, assignSnag } = require('../services/postSale/snagService');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');

const router = express.Router({ mergeParams: true });

router.use(authenticate);

// GET /api/snags
router.get('/', async (req, res, next) => {
  try {
    const { projectId, status, assigneeId, category, page, limit } = req.query;
    const snags = await getSnags({
      tenantId: req.user.tenantId,
      projectId,
      status,
      assigneeId,
      category,
      page: page ? parseInt(page) : 1,
      limit: limit ? parseInt(limit) : 50
    });
    return success(res, snags);
  } catch (error) {
    next(error);
  }
});

// POST /api/snags
router.post('/', async (req, res, next) => {
  try {
    const { projectId, title, description, photoKeys, category, rootCauseCategory, vendorId } = req.body;
    
    if (!projectId || !title) {
      return fail(res, 'BAD_REQUEST', 'Project ID and Title are required', 400);
    }
    
    const snag = await require('../services/postSale/snagService').createSnag({
      tenantId: req.user.tenantId,
      projectId,
      raisedBy: req.user.userId,
      raisedByClient: false,
      title,
      description,
      photoKeys,
      category,
      rootCauseCategory,
      vendorId
    });
    
    return success(res, snag, 201);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/snags/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const snagId = req.params.id;
    const { 
      status, 
      assigneeId, 
      resolutionNote,
      reworkRequired,
      reworkRootCauseCategory,
      reworkEstimatedHours,
      reworkActualHours,
      reworkCost,
      rootCauseCategory,
      vendorId
    } = req.body;
    const tenantId = req.user.tenantId;
    const userId = req.user.userId;

    let updatedSnag;

    if (assigneeId) {
      updatedSnag = await assignSnag({ tenantId, snagId, assigneeId, userId });
    }

    if (status || rootCauseCategory || vendorId || resolutionNote || reworkRequired !== undefined) {
      updatedSnag = await updateSnagStatus({ 
        tenantId, 
        snagId, 
        status, 
        resolutionNote, 
        userId,
        reworkRequired,
        reworkRootCauseCategory,
        reworkEstimatedHours,
        reworkActualHours,
        reworkCost,
        rootCauseCategory,
        vendorId
      });
    }

    if (!updatedSnag) {
      return fail(res, 'BAD_REQUEST', 'No update fields provided', 400);
    }

    return success(res, updatedSnag);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
