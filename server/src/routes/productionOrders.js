const express = require('express');
const router = express.Router({ mergeParams: true });
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const productionOrderController = require('../controllers/productionOrderController');

// List production orders for a project
router.get('/', authenticate, authorize('projects:read'), productionOrderController.getProjectProductionOrders);

// Create a new production order for a project
router.post('/', authenticate, authorize('projects:update'), productionOrderController.createProductionOrder);

// Get detailed production order
router.get('/:id', authenticate, authorize('projects:read'), productionOrderController.getProductionOrder);

// Update production order details (status, factory name, notes, etc.)
router.put('/:id', authenticate, authorize('projects:update'), productionOrderController.updateProductionOrder);

// Update details/schedule for a specific production order item
router.put('/:id/items/:itemId', authenticate, authorize('projects:update'), productionOrderController.updateProductionOrderItem);

// Record QC inspection for a specific item
router.post('/:id/items/:itemId/qc', authenticate, authorize('projects:update'), productionOrderController.recordQCInspection);

// Create rework order for an item
router.post('/:id/items/:itemId/rework', authenticate, authorize('projects:update'), productionOrderController.createReworkOrder);

// Update rework order status
router.put('/:id/rework/:reworkId', authenticate, authorize('projects:update'), productionOrderController.updateReworkOrderStatus);

// Clear production order for dispatch (Clearance gate check)
router.post('/:id/clear-dispatch', authenticate, authorize('projects:update'), productionOrderController.clearOrderForDispatch);

// Get QC and Rework Summary for a production order
router.get('/:id/qc-rework-summary', authenticate, authorize('projects:read'), productionOrderController.getQCAndReworkSummary);

// Dispatch a production order batch (cleared by QC gate)
router.post('/:id/dispatch', authenticate, authorize('projects:update'), productionOrderController.dispatchProductionOrder);

// Confirm receipt / delivery at site
router.put('/:id/dispatch/:dispatchId/receipt', authenticate, authorize('projects:update'), productionOrderController.confirmSiteDelivery);

// Get list of dispatches/transits
router.get('/:id/dispatch', authenticate, authorize('projects:read'), productionOrderController.getDispatchRecords);

// Log transit damage for a specific item in a dispatch
router.post('/:id/dispatch/:dispatchId/items/:itemId/damage', authenticate, authorize('projects:update'), productionOrderController.createTransitDamageReport);

// Initiate replacement production order for a transit damage report
router.post('/:id/damage/:damageId/replacement', authenticate, authorize('projects:update'), productionOrderController.initiateReplacementOrder);

// Update status/liability details for a transit damage report
router.put('/:id/damage/:damageId', authenticate, authorize('projects:update'), productionOrderController.updateTransitDamageStatus);

// Fetch transit damage reports for the production order batch
router.get('/:id/damage', authenticate, authorize('projects:read'), productionOrderController.getTransitDamageRecords);

module.exports = router;
