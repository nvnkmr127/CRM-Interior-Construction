const express = require('express');
const router = express.Router();
const vendorLeadTimeController = require('../controllers/vendorLeadTimeController');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');

router.get('/', authenticate, authorize('projects:read'), vendorLeadTimeController.listLeadTimes);
router.post('/', authenticate, authorize('projects:update'), vendorLeadTimeController.saveLeadTime);
router.delete('/:id', authenticate, authorize('projects:update'), vendorLeadTimeController.deleteLeadTime);

module.exports = router;
