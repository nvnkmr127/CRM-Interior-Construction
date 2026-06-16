/**
 * Email Action Handler (Stub)
 */
async function handle(config, context) {
  const { templateId, recipientField } = config;
  const { record } = context;

  const email = record[recipientField] || 'UNKNOWN_EMAIL';
  console.log(`[Automation Action] Email would be sent to ${email} (Template ID: ${templateId})`);
}

module.exports = { handle };
