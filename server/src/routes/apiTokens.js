const express = require('express');
const router = express.Router();
const apiTokenController = require('../controllers/apiTokenController');
const authenticate = require('../middleware/authenticate'); // these routes are managed by standard CRM users

router.use(authenticate);

router.get('/dashboard', apiTokenController.getDashboardStats);
router.get('/', apiTokenController.getTokens);
router.post('/', apiTokenController.createToken);
router.put('/:id', apiTokenController.updateToken);
router.post('/:id/regenerate', apiTokenController.regenerateToken);
router.delete('/:id', apiTokenController.deleteToken);

module.exports = router;
