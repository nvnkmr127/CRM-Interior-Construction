const express = require('express');
const router = express.Router();
const leaveController = require('../controllers/leaveController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.use(authenticate);

// GET /api/leaves
router.get('/', authorize('analytics:read'), leaveController.getLeaves);

// GET /api/leaves/impact/:userId
router.get('/impact/:userId', authorize('projects:write'), leaveController.getLeaveImpact);

// POST /api/leaves
router.post('/', authorize('projects:write'), leaveController.createLeave);

module.exports = router;
