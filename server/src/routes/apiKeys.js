const express = require('express');
const router = express.Router();
const apiKeyController = require('../controllers/apiKeyController');
const authenticate = require('../middleware/authenticate'); // these routes are managed by standard CRM users

router.use(authenticate);

router.get('/dashboard', apiKeyController.getDashboardStats);
router.get('/', apiKeyController.getKeys);
router.post('/', apiKeyController.createKey);
router.put('/:id', apiKeyController.updateKey);
router.post('/:id/regenerate', apiKeyController.regenerateKey);
router.delete('/:id', apiKeyController.deleteKey);

module.exports = router;
