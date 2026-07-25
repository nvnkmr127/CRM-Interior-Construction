const express = require('express');
const router = express.Router({ mergeParams: true });
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const quotationController = require('../controllers/quotationController');

// List quotations for a project
router.get('/', authenticate, authorize('quotations:view'), quotationController.getProjectQuotations);

// Create a new quotation for a project
router.post('/', authenticate, authorize('quotations:create'), quotationController.createQuotation);

// Get a quotation with BOQ items
router.get('/:id', authenticate, authorize('quotations:view'), quotationController.getQuotation);

// Update a quotation config/details
router.put('/:id', authenticate, authorize('quotations:edit'), quotationController.updateQuotation);

// Add a BOQ item to a quotation
router.post('/:id/items', authenticate, authorize('boq:create'), quotationController.addBOQItem);

// Update a BOQ item
router.put('/:id/items/:itemId', authenticate, authorize('boq:edit'), quotationController.updateBOQItem);

// Delete a BOQ item
router.delete('/:id/items/:itemId', authenticate, authorize('boq:delete'), quotationController.deleteBOQItem);

// Revise a quotation (create a new version)
router.post('/:id/revise', authenticate, authorize('boq:edit'), quotationController.reviseQuotation);

// Compare two quotation versions
router.get('/:id/compare/:targetId', authenticate, authorize('boq:compare_versions'), quotationController.compareQuotations);

// Send, accept, and reject quotations
router.post('/:id/send', authenticate, authorize('quotations:edit'), quotationController.sendQuotation);
router.post('/:id/accept', authenticate, authorize('quotations:approve'), quotationController.acceptQuotation);
router.post('/:id/reject', authenticate, authorize('quotations:approve'), quotationController.rejectQuotation);

module.exports = router;

