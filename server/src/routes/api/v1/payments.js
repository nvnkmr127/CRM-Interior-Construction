const express = require('express');
const router = express.Router();
const paymentsController = require('../../../controllers/v1/paymentsController');
const { apiAuth } = require('../../../middlewares/apiAuth');
const apiLogger = require('../../../middlewares/apiLogger');

router.use(apiLogger);

router.get('/', apiAuth('Payments Read'), paymentsController.listPayments);
router.get('/:id', apiAuth('Payments Read'), paymentsController.getPayment);
router.post('/', apiAuth('Payments Write'), paymentsController.createPayment);
router.put('/:id', apiAuth('Payments Write'), paymentsController.updatePayment);
router.delete('/:id', apiAuth('Payments Write'), paymentsController.deletePayment);

module.exports = router;
