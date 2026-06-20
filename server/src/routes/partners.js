const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const partnerController = require('../controllers/partnerController');

router.get('/', authenticate, partnerController.getPartners);

module.exports = router;
