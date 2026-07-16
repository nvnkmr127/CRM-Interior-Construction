const express = require('express');
const { _z } = require('zod');
const punchListRepository = require('../../repositories/punchListRepository');
const authenticatePortal = require('../../middleware/authenticatePortal');
const { success, fail } = require('../../utils/response');

const router = express.Router();

router.use(authenticatePortal);

// GET /api/portal/punch-lists
router.get('/', async (req, res, next) => {
  try {
    const { tenantId, projectId } = req.portalUser;
    const list = await punchListRepository.getPunchLists(tenantId, projectId);
    return success(res, list);
  } catch (error) {
    next(error);
  }
});

// GET /api/portal/punch-lists/:id
router.get('/:id', async (req, res, next) => {
  try {
    const { tenantId } = req.portalUser;
    const pl = await punchListRepository.getPunchListById(tenantId, req.params.id);
    if (!pl) return fail(res, 'NOT_FOUND', 'Punch list not found', 404);
    return success(res, pl);
  } catch (error) {
    next(error);
  }
});

// POST /api/portal/punch-lists/items/:itemId/verify
router.post('/items/:itemId/verify', async (req, res, next) => {
  try {
    const { tenantId } = req.portalUser;
    
    // We update item status to 'verified'
    const updated = await punchListRepository.updatePunchListItem(
      tenantId,
      req.params.itemId,
      { status: 'verified' }
    );
    
    return success(res, updated);
  } catch (error) {
    if (error.message === 'Item not found') {
      return fail(res, 'NOT_FOUND', error.message, 404);
    }
    next(error);
  }
});

// POST /api/portal/punch-lists/:id/sign-off
router.post('/:id/sign-off', async (req, res, next) => {
  try {
    const { tenantId } = req.portalUser;
    
    // Verify all items are indeed 'verified' before allowing walkthrough sign-off
    const pl = await punchListRepository.getPunchListById(tenantId, req.params.id);
    if (!pl) return fail(res, 'NOT_FOUND', 'Punch list not found', 404);
    
    const unverifiedItems = pl.items.filter(item => item.status !== 'verified');
    if (unverifiedItems.length > 0) {
      return fail(res, 'PUNCH_ITEMS_NOT_VERIFIED', 'All punch list items must be verified by client first.', 400);
    }
    
    const updated = await punchListRepository.updatePunchList(tenantId, req.params.id, {
      status: 'client_verified',
      signed_off_by_client: true,
      client_signed_off_at: new Date().toISOString()
    });
    
    return success(res, updated);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
