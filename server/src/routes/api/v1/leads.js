const express = require('express');
const router = express.Router();
const leadsController = require('../../../controllers/v1/leadsController');
const { apiAuth } = require('../../../middlewares/apiAuth');
const apiLogger = require('../../../middlewares/apiLogger');

// All endpoints require 'Leads Read' or 'Leads Write' permission
router.use(apiLogger);

router.get('/', apiAuth('Leads Read'), leadsController.listLeads);
router.get('/:id', apiAuth('Leads Read'), leadsController.getLead);
router.post('/', apiAuth('Leads Write'), leadsController.createLead);
router.put('/:id', apiAuth('Leads Write'), leadsController.updateLead);
router.delete('/:id', apiAuth('Leads Write'), leadsController.deleteLead);

module.exports = router;
