const express = require('express');
const router = express.Router({ mergeParams: true });
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const productionOrderController = require('../controllers/productionOrderController');

// List production orders for a project
router.get('/', authenticate, authorize('projects:read'), productionOrderController.getProjectProductionOrders);

// Create a new production order for a project
router.post('/', authenticate, authorize('procurement:manage'), productionOrderController.createProductionOrder);

// Get detailed production order
router.get('/:id', authenticate, authorize('projects:read'), productionOrderController.getProductionOrder);

// Update production order details (status, factory name, notes, etc.)
router.put('/:id', authenticate, authorize('procurement:manage'), productionOrderController.updateProductionOrder);

// Update details/schedule for a specific production order item
router.put('/:id/items/:itemId', authenticate, authorize('procurement:manage'), productionOrderController.updateProductionOrderItem);

// Record QC inspection for a specific item
router.post('/:id/items/:itemId/qc', authenticate, authorize('procurement:manage'), productionOrderController.recordQCInspection);

// Create rework order for an item
router.post('/:id/items/:itemId/rework', authenticate, authorize('procurement:manage'), productionOrderController.createReworkOrder);

// Update rework order status
router.put('/:id/rework/:reworkId', authenticate, authorize('procurement:manage'), productionOrderController.updateReworkOrderStatus);

// Clear production order for dispatch (Clearance gate check)
router.post('/:id/clear-dispatch', authenticate, authorize('procurement:manage'), productionOrderController.clearOrderForDispatch);

// Get QC and Rework Summary for a production order
router.get('/:id/qc-rework-summary', authenticate, authorize('projects:read'), productionOrderController.getQCAndReworkSummary);

// Dispatch a production order batch (cleared by QC gate)
router.post('/:id/dispatch', authenticate, authorize('procurement:manage'), productionOrderController.dispatchProductionOrder);

// Confirm receipt / delivery at site
router.put('/:id/dispatch/:dispatchId/receipt', authenticate, authorize('procurement:manage'), productionOrderController.confirmSiteDelivery);

// Get list of dispatches/transits
router.get('/:id/dispatch', authenticate, authorize('projects:read'), productionOrderController.getDispatchRecords);

// Log transit damage for a specific item in a dispatch
router.post('/:id/dispatch/:dispatchId/items/:itemId/damage', authenticate, authorize('procurement:manage'), productionOrderController.createTransitDamageReport);

// Initiate replacement production order for a transit damage report
router.post('/:id/damage/:damageId/replacement', authenticate, authorize('procurement:manage'), productionOrderController.initiateReplacementOrder);

// Update status/liability details for a transit damage report
router.put('/:id/damage/:damageId', authenticate, authorize('procurement:manage'), productionOrderController.updateTransitDamageStatus);

// Fetch transit damage reports for the production order batch
router.get('/:id/damage', authenticate, authorize('projects:read'), productionOrderController.getTransitDamageRecords);

// Cutting Lists
router.get('/:id/items/:itemId/cutting-list', authenticate, authorize('projects:read'), productionOrderController.getCuttingList);
router.post('/:id/items/:itemId/cutting-list', authenticate, authorize('procurement:manage'), productionOrderController.saveCuttingList);

// CNC Requests
router.get('/:id/cnc-requests', authenticate, authorize('projects:read'), productionOrderController.getCNCRequests);
router.post('/:id/cnc-requests', authenticate, authorize('procurement:manage'), productionOrderController.createCNCRequest);
router.put('/:id/cnc-requests/:requestId', authenticate, authorize('procurement:manage'), productionOrderController.updateCNCRequestStatus);

module.exports = router;
