const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const aiController = require('../controllers/aiController');
const aiRateLimiter = require('../middleware/aiRateLimiter');

const router = express.Router();

router.post('/leads/:id/summary', authenticate, authorize('leads:read'), aiRateLimiter, aiController.getLeadSummaryHandler);
router.post('/leads/:id/score', authenticate, authorize('leads:read'), aiRateLimiter, aiController.getLeadScoreHandler);
router.get('/leads/:id/recommendations', authenticate, authorize('leads:read'), aiRateLimiter, aiController.getRecommendationsHandler);
router.post('/copilot/chat', authenticate, aiRateLimiter, aiController.copilotChatHandler);

module.exports = router;
