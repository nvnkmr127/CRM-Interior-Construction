const express = require('express');
const router = express.Router();
const eventsController = require('../controllers/eventsController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.use(authenticate);

// Event Polling endpoints
router.get('/', authorize('events:read'), eventsController.getEvents);

module.exports = router;
