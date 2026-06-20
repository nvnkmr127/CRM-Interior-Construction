const express = require('express');
const router = express.Router();
const portalController = require('../controllers/portalController');

// Public read-only route accessed by a tracking code
router.get('/project/:trackingCode', portalController.getProjectStatusHandler);

module.exports = router;
