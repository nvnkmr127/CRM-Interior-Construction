const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const leadController = require('../controllers/leadController');

const router = express.Router();

router.post('/', authenticate, authorize('leads:create'), leadController.createLeadHandler);
router.get('/', authenticate, authorize('leads:read'), leadController.getLeadsHandler);
router.get('/stats', authenticate, authorize('leads:read'), leadController.getLeadStatsHandler);
router.get('/:id', authenticate, authorize('leads:read'), leadController.getLeadByIdHandler);
router.patch('/:id', authenticate, authorize('leads:update'), leadController.updateLeadHandler);
router.delete('/:id', authenticate, authorize('leads:delete'), leadController.deleteLeadHandler);
router.post('/bulk/delete', authenticate, authorize('leads:delete'), leadController.bulkDeleteLeadsHandler);
router.post('/bulk/assign', authenticate, authorize('leads:update'), leadController.bulkAssignLeadsHandler);
router.post('/:id/stage', authenticate, authorize('leads:update'), leadController.changeStageHandler);
router.post('/:id/activities', authenticate, leadController.logActivityHandler);
router.get('/:id/activities', authenticate, leadController.getActivitiesHandler);

module.exports = router;
