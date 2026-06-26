const express = require('express');
const router = express.Router({ mergeParams: true });
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const purchaseOrderController = require('../controllers/purchaseOrderController');

// List purchase orders for a project
router.get('/', authenticate, authorize('projects:read'), purchaseOrderController.getProjectPurchaseOrders);

// Create a new purchase order for a project
router.post('/', authenticate, authorize('projects:update'), purchaseOrderController.createPurchaseOrder);

// Get detailed purchase order
router.get('/:id', authenticate, authorize('projects:read'), purchaseOrderController.getPurchaseOrder);

// Update purchase order details (expected delivery date, notes, status, etc.)
router.put('/:id', authenticate, authorize('projects:update'), purchaseOrderController.updatePurchaseOrder);

// Update received quantity for a specific PO item
router.put('/:id/items/:itemId/receipt', authenticate, authorize('projects:update'), purchaseOrderController.updatePOItemReceipt);

module.exports = router;
