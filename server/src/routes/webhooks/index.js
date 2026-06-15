const express = require('express');
const inboundRouter = require('./inbound');

const router = express.Router();

router.use('/inbound', inboundRouter);

module.exports = router;
