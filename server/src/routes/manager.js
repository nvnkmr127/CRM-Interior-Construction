const express = require('express');
const router = express.Router();
const managerController = require('../controllers/managerController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

// Note: Ensure that the user has 'admin' or 'manager' role for these
// For now we map to the standard 'leads:read' or custom manager auth logic
const managerAuth = [authenticate, authorize('leads:read')];

router.get('/sla-breaches', managerAuth, managerController.getSlaBreaches);
router.get('/pipeline-movement', managerAuth, managerController.getPipelineMovement);
router.get('/rep-capacity', managerAuth, managerController.getRepCapacity);
router.get('/score-distribution', managerAuth, managerController.getScoreDistribution);
router.get('/pending-approvals', managerAuth, managerController.getPendingApprovals);
router.get('/scheduled-visits', managerAuth, managerController.getScheduledVisits);

router.post('/approvals/:id/decide', managerAuth, managerController.decideApproval);

module.exports = router;
