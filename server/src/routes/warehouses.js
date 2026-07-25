const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const warehouseController = require('../controllers/warehouseController');

// All routes require authentication
router.use(authenticate);

// Warehouse management routes
router.get('/', authorize('warehouse:inventory_view'), warehouseController.listWarehouses);
router.post('/', authorize('warehouse:create'), warehouseController.createWarehouse);

// Inventory list & transaction routes
router.get('/:warehouseId/inventory', authorize('warehouse:inventory_view'), warehouseController.getInventory);
router.get('/:warehouseId/quarantined', authorize('warehouse:inventory_view'), warehouseController.getQuarantined);
router.get('/:warehouseId/transactions', authorize('warehouse:audit'), warehouseController.getTransactions);

// Material transaction endpoints
router.post('/:warehouseId/receive', authorize('warehouse:receive_material'), warehouseController.receiveMaterial);
router.post('/:warehouseId/dispatch', authorize('warehouse:issue_material'), warehouseController.dispatchToSite);
router.post('/:warehouseId/return', authorize('warehouse:receive_material'), warehouseController.returnFromSite);
router.post('/:warehouseId/quarantine', authorize('warehouse:stock_adjustment'), warehouseController.quarantineMaterial);
router.post('/:warehouseId/release', authorize('warehouse:stock_adjustment'), warehouseController.releaseFromQuarantine);

module.exports = router;
