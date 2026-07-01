const express = require('express');
const router = express.Router({ mergeParams: true });
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const materialDeliveryController = require('../controllers/materialDeliveryController');

// List material deliveries for a project
router.get('/', authenticate, authorize('projects:read'), materialDeliveryController.getProjectMaterialDeliveries);

// Create/log a new material delivery (goods receipt)
router.post('/', authenticate, authorize('procurement:manage'), materialDeliveryController.createMaterialDelivery);

// Get detailed material delivery receipt
router.get('/:id', authenticate, authorize('projects:read'), materialDeliveryController.getMaterialDelivery);

// Update material delivery details/status
router.put('/:id', authenticate, authorize('procurement:manage'), materialDeliveryController.updateMaterialDelivery);

// Log incoming material inspection record
router.post('/:id/inspect', authenticate, authorize('procurement:manage'), materialDeliveryController.inspectMaterialDelivery);

module.exports = router;
