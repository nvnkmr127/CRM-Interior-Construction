const express = require('express');
const authenticate = require('../middleware/authenticate');
const mobileController = require('../controllers/mobileController');

const router = express.Router();

router.get('/dashboard', authenticate, mobileController.getMobileDashboard);

module.exports = router;
