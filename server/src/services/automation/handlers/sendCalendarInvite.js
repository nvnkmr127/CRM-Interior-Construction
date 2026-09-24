const logger = require('../../../utils/logger');

/**
 * Calendar Invite Action Handler (Stub)
 */
async function handle(config, context) {
  const { title, recipientField } = config || {};
  const { record, tenantId } = context;

  const email = (record && (record[recipientField] || record.email)) || 'UNKNOWN_EMAIL';
  logger.info(`[Automation Action] Calendar invite '${title || 'Meeting'}' scheduled for ${email} in tenant ${tenantId}`);
}

module.exports = { handle };
