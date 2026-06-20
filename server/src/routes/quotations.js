const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const quotationController = require('../controllers/quotationController');

// Create a new quotation
router.post('/', authenticate, authorize('projects:update'), quotationController.createQuotation);

// Get a quotation with BOQ items
router.get('/:id', authenticate, authorize('projects:read'), quotationController.getQuotation);

// Add a BOQ item to a quotation
router.post('/:id/items', authenticate, authorize('projects:update'), quotationController.addBOQItem);

module.exports = router;
