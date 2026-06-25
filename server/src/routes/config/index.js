const express = require('express');
const customFieldsRouter = require('./customFields');
const projectTemplatesRouter = require('./projectTemplates');
const automationsRouter = require('./automations');
const leadStagesRouter = require('./leadStages');
const webhookSourcesRouter = require('./webhookSources');
const apiKeysRouter = require('./apiKeys');
const webhooksRouter = require('./webhooks');
const tenantSettingsRouter = require('./tenantSettings');

const router = express.Router();

router.use('/custom-fields', customFieldsRouter);
router.use('/project-templates', projectTemplatesRouter);
router.use('/automations', automationsRouter);
router.use('/lead-stages', leadStagesRouter);
router.use('/webhook-sources', webhookSourcesRouter);
router.use('/api-keys', apiKeysRouter);
router.use('/webhooks', webhooksRouter);
router.use('/tenant-settings', tenantSettingsRouter);

module.exports = router;
