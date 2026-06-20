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

// Toggle Status
router.post('/rules/:id/toggle', authenticate, automationController.toggleRule);

// Analytics
router.get('/analytics', authenticate, automationController.getAnalytics);

// Recent Logs/Events
router.get('/logs', authenticate, automationController.getLogs);

// Phase 2: Workflow & Automation APIs
// Alias rules as workflows
router.get('/workflows', authenticate, automationController.getRules);
router.post('/workflows', authenticate, automationController.createRule);

// Workflow Execution
router.post('/run', authenticate, automationController.runWorkflow);
router.get('/history', authenticate, automationController.getHistory);
router.get('/templates', authenticate, automationController.getAutomationTemplates);

module.exports = router;
