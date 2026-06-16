const express = require('express');
const inboundRouter = require('./inbound');
const leadIngestRouter = require('./leadIngest');

const router = express.Router();

router.use('/inbound', inboundRouter);
router.use('/lead-ingest', leadIngestRouter);

module.exports = router;
