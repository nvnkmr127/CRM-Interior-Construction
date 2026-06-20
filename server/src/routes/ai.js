const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const aiController = require('../controllers/aiController');

const router = express.Router();

router.post('/leads/:id/summary', authenticate, authorize('leads:read'), aiController.getLeadSummaryHandler);
router.post('/leads/:id/score', authenticate, authorize('leads:read'), aiController.getLeadScoreHandler);
router.get('/leads/:id/recommendations', authenticate, authorize('leads:read'), aiController.getRecommendationsHandler);
router.post('/copilot/chat', authenticate, aiController.copilotChatHandler);

module.exports = router;
