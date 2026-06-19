const express = require('express');
const router = express.Router();
const automationController = require('../controllers/automationController');
const authenticate = require('../middleware/authenticate');

// Rules
router.get('/rules', authenticate, automationController.getRules);
router.post('/rules', authenticate, automationController.createRule);
router.get('/rules/:id', authenticate, automationController.getRuleById);
router.patch('/rules/:id', authenticate, automationController.updateRule);
router.delete('/rules/:id', authenticate, automationController.deleteRule);

const stubHandler = (req, res) => res.status(501).json({ success: false, error: 'Not implemented' });

// Toggle Status
router.post('/rules/:id/toggle', authenticate, stubHandler);

// Analytics
router.get('/analytics', authenticate, stubHandler);

// Recent Logs/Events
router.get('/logs', authenticate, stubHandler);

module.exports = router;
