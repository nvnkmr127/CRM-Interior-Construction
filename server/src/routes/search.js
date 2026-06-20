const express = require('express');
const authenticate = require('../middleware/authenticate');
const searchController = require('../controllers/searchController');

const router = express.Router();

router.use(authenticate);

router.get('/', searchController.globalSearchHandler);

module.exports = router;
