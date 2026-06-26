const express = require('express');
const router = express.Router({ mergeParams: true });
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const quotationController = require('../controllers/quotationController');

// List quotations for a project
router.get('/', authenticate, authorize('projects:read'), quotationController.getProjectQuotations);

// Create a new quotation for a project
router.post('/', authenticate, authorize('projects:update'), quotationController.createQuotation);

// Get a quotation with BOQ items
router.get('/:id', authenticate, authorize('projects:read'), quotationController.getQuotation);

// Update a quotation config/details
router.put('/:id', authenticate, authorize('projects:update'), quotationController.updateQuotation);

// Add a BOQ item to a quotation
router.post('/:id/items', authenticate, authorize('projects:update'), quotationController.addBOQItem);

// Update a BOQ item
router.put('/:id/items/:itemId', authenticate, authorize('projects:update'), quotationController.updateBOQItem);

// Delete a BOQ item
router.delete('/:id/items/:itemId', authenticate, authorize('projects:update'), quotationController.deleteBOQItem);

// Revise a quotation (create a new version)
router.post('/:id/revise', authenticate, authorize('projects:update'), quotationController.reviseQuotation);

// Compare two quotation versions
router.get('/:id/compare/:targetId', authenticate, authorize('projects:read'), quotationController.compareQuotations);

// Send, accept, and reject quotations
router.post('/:id/send', authenticate, authorize('projects:update'), quotationController.sendQuotation);
router.post('/:id/accept', authenticate, authorize('projects:update'), quotationController.acceptQuotation);
router.post('/:id/reject', authenticate, authorize('projects:update'), quotationController.rejectQuotation);

module.exports = router;

