const express = require('express');
const router = express.Router({ mergeParams: true });
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const purchaseRequestController = require('../controllers/purchaseRequestController');

// List purchase requests for a project
router.get('/', authenticate, authorize('projects:read'), purchaseRequestController.getProjectPurchaseRequests);

// Create a new purchase request for a project
router.post('/', authenticate, authorize('procurement:manage'), purchaseRequestController.createPurchaseRequest);

// Get detailed purchase request
router.get('/:id', authenticate, authorize('projects:read'), purchaseRequestController.getPurchaseRequest);

// Update purchase request details or status (PM approval / rejection)
router.put('/:id', authenticate, authorize('procurement:manage'), purchaseRequestController.updatePurchaseRequest);

// Convert approved purchase request to draft purchase order
router.post('/:id/convert', authenticate, authorize('procurement:manage'), purchaseRequestController.convertToPurchaseOrder);

module.exports = router;
