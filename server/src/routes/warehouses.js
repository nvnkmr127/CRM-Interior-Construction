const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const warehouseController = require('../controllers/warehouseController');

// All routes require authentication
router.use(authenticate);

// Warehouse management routes
router.get('/', warehouseController.listWarehouses);
router.post('/', warehouseController.createWarehouse);

// Inventory list & transaction routes
router.get('/:warehouseId/inventory', warehouseController.getInventory);
router.get('/:warehouseId/quarantined', warehouseController.getQuarantined);
router.get('/:warehouseId/transactions', warehouseController.getTransactions);

// Material transaction endpoints
router.post('/:warehouseId/receive', warehouseController.receiveMaterial);
router.post('/:warehouseId/dispatch', warehouseController.dispatchToSite);
router.post('/:warehouseId/return', warehouseController.returnFromSite);
router.post('/:warehouseId/quarantine', warehouseController.quarantineMaterial);
router.post('/:warehouseId/release', warehouseController.releaseFromQuarantine);

module.exports = router;
