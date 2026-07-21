const express = require('express');
const router = express.Router();
const quotationsController = require('../../../controllers/v1/quotationsController');
const { apiAuth } = require('../../../middlewares/apiAuth');
const apiLogger = require('../../../middlewares/apiLogger');

router.use(apiLogger);

router.get('/', apiAuth('Projects Read'), quotationsController.listQuotations);
router.get('/:id', apiAuth('Projects Read'), quotationsController.getQuotation);
router.post('/', apiAuth('Projects Write'), quotationsController.createQuotation);
router.put('/:id', apiAuth('Projects Write'), quotationsController.updateQuotation);
router.delete('/:id', apiAuth('Projects Write'), quotationsController.deleteQuotation);

module.exports = router;
