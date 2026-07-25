const express = require('express');
const router = express.Router({ mergeParams: true });
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const productionOrderController = require('../controllers/productionOrderController');

// List production orders for a project
router.get('/', authenticate, authorize('factory:production_status'), productionOrderController.getProjectProductionOrders);

// Create a new production order for a project
router.post('/', authenticate, authorize('factory:production_planning'), productionOrderController.createProductionOrder);

// Get detailed production order
router.get('/:id', authenticate, authorize('factory:production_status'), productionOrderController.getProductionOrder);

// Update production order details (status, factory name, notes, etc.)
router.put('/:id', authenticate, authorize('factory:production_planning'), productionOrderController.updateProductionOrder);

// Update details/schedule for a specific production order item
router.put('/:id/items/:itemId', authenticate, authorize('factory:production_planning'), productionOrderController.updateProductionOrderItem);

// Record QC inspection for a specific item
router.post('/:id/items/:itemId/qc', authenticate, authorize('factory:quality_check'), productionOrderController.recordQCInspection);

// Create rework order for an item
router.post('/:id/items/:itemId/rework', authenticate, authorize('factory:quality_check'), productionOrderController.createReworkOrder);

// Update rework order status
router.put('/:id/rework/:reworkId', authenticate, authorize('factory:quality_check'), productionOrderController.updateReworkOrderStatus);

// Clear production order for dispatch (Clearance gate check)
router.post('/:id/clear-dispatch', authenticate, authorize('factory:quality_check'), productionOrderController.clearOrderForDispatch);

// Get QC and Rework Summary for a production order
router.get('/:id/qc-rework-summary', authenticate, authorize('factory:production_status'), productionOrderController.getQCAndReworkSummary);

// Dispatch a production order batch (cleared by QC gate)
router.post('/:id/dispatch', authenticate, authorize('factory:dispatch'), productionOrderController.dispatchProductionOrder);

// Confirm receipt / delivery at site
router.put('/:id/dispatch/:dispatchId/receipt', authenticate, authorize('factory:dispatch'), productionOrderController.confirmSiteDelivery);

// Get list of dispatches/transits
router.get('/:id/dispatch', authenticate, authorize('factory:production_status'), productionOrderController.getDispatchRecords);

// Log transit damage for a specific item in a dispatch
router.post('/:id/dispatch/:dispatchId/items/:itemId/damage', authenticate, authorize('factory:quality_check'), productionOrderController.createTransitDamageReport);

// Initiate replacement production order for a transit damage report
router.post('/:id/damage/:damageId/replacement', authenticate, authorize('factory:production_planning'), productionOrderController.initiateReplacementOrder);

// Update status/liability details for a transit damage report
router.put('/:id/damage/:damageId', authenticate, authorize('factory:quality_check'), productionOrderController.updateTransitDamageStatus);

// Fetch transit damage reports for the production order batch
router.get('/:id/damage', authenticate, authorize('factory:production_status'), productionOrderController.getTransitDamageRecords);

// Cutting Lists
router.get('/:id/items/:itemId/cutting-list', authenticate, authorize('factory:production_planning'), productionOrderController.getCuttingList);
router.post('/:id/items/:itemId/cutting-list', authenticate, authorize('factory:production_planning'), productionOrderController.saveCuttingList);

// CNC Requests
router.get('/:id/cnc-requests', authenticate, authorize('factory:production_status'), productionOrderController.getCNCRequests);
router.post('/:id/cnc-requests', authenticate, authorize('factory:production_planning'), productionOrderController.createCNCRequest);
router.put('/:id/cnc-requests/:requestId', authenticate, authorize('factory:production_planning'), productionOrderController.updateCNCRequestStatus);

module.exports = router;
