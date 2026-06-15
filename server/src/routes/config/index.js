const express = require('express');
const customFieldsRouter = require('./customFields');
const projectTemplatesRouter = require('./projectTemplates');
const automationsRouter = require('./automations');

const router = express.Router();

router.use('/custom-fields', customFieldsRouter);
router.use('/project-templates', projectTemplatesRouter);
router.use('/automations', automationsRouter);
// router.use('/lead-stages', ...) // Dev 2 will add this

module.exports = router;
