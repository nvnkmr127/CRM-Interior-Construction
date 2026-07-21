const express = require('express');
const router = express.Router();
const leadFormController = require('../controllers/leadFormController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.use(authenticate);

// List all forms
router.get('/', authorize('leads:read'), leadFormController.getForms);

// Create a new form
router.post('/', authorize('leads:create'), leadFormController.createForm);

// Get a specific form
router.get('/:id', authorize('leads:read'), leadFormController.getFormById);

// Update a form
router.put('/:id', authorize('leads:update'), leadFormController.updateForm);

// Delete a form
router.delete('/:id', authorize('leads:delete'), leadFormController.deleteForm);

// Get form submissions
router.get('/:id/submissions', authorize('leads:read'), leadFormController.getFormSubmissions);

module.exports = router;
