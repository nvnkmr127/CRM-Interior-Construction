const express = require('express');
const router = express.Router({ mergeParams: true });
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const vendorPaymentController = require('../controllers/vendorPaymentController');

// List vendor payment milestones for a project
router.get('/', authenticate, authorize('projects:read'), vendorPaymentController.getProjectVendorPaymentMilestones);

// Schedule a new vendor payment milestone
router.post('/', authenticate, authorize('finance:payments'), vendorPaymentController.createVendorPaymentMilestone);

// Get detailed payment milestone
router.get('/:id', authenticate, authorize('projects:read'), vendorPaymentController.getVendorPaymentMilestone);

// Log/update payment data against a milestone
router.put('/:id', authenticate, authorize('finance:payments'), vendorPaymentController.updateVendorPaymentMilestone);

// Delete a scheduled vendor milestone
router.delete('/:id', authenticate, authorize('finance:payments'), vendorPaymentController.deleteVendorPaymentMilestone);

module.exports = router;
