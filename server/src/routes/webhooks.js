const express = require('express');
const router = express.Router();
const webhookController = require('../controllers/webhookController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.use(authenticate);

// Webhook CRUD endpoints
router.post('/', authorize('webhooks:write'), webhookController.createWebhook);
router.get('/', authorize('webhooks:read'), webhookController.getWebhooks);
router.delete('/:id', authorize('webhooks:write'), webhookController.deleteWebhook);
router.get('/logs', authorize('webhooks:read'), webhookController.getWebhookLogs);

module.exports = router;
