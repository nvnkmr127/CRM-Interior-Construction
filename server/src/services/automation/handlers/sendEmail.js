const logger = require('../../../utils/logger');
/**
 * Email Action Handler (Stub)
 */
async function handle(config, context) {
  const { templateId, recipientField } = config;
  const { record } = context;

  const email = record[recipientField] || record.email || 'UNKNOWN_EMAIL';
  if (email === 'UNKNOWN_EMAIL') {
    logger.info(`[Automation Action] No email address found to send email (Template ID: ${templateId})`);
    return;
  }
  logger.info(`[Automation Action] Email would be sent to ${email} (Template ID: ${templateId})`);
}

module.exports = { handle };
