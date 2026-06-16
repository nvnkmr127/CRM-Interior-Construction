/**
 * WhatsApp Action Handler (Stub)
 * Full WABA integration will be built out in Phase 2.
 */
async function handle(config, context) {
  const { templateName, recipientField } = config;
  const { record } = context;

  const phone = record[recipientField] || 'UNKNOWN_PHONE';
  console.log(`[Automation Action] WhatsApp message would be sent to ${phone} using template '${templateName}'`);
}

module.exports = { handle };
