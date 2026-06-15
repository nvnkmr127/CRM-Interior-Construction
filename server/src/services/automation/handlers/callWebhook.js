let webhookDispatcher;

// Dev 2 will physically build the dispatcher module in Task D2-38. 
// We utilize a dynamic try/catch hook to ensure our automations module boots up safely even if the webhook framework isn't merged yet.
try {
  webhookDispatcher = require('../../../webhooks/webhookDispatcher');
} catch (e) {
  webhookDispatcher = null;
}

/**
 * Webhook Dispatch Action Handler
 */
async function handle(config, context) {
  const { webhookId } = config;
  const { tenantId, record } = context;

  if (webhookDispatcher && typeof webhookDispatcher.dispatchEvent === 'function') {
    // Pipe the physical automation logic output straight into the generic webhook payload engine
    await webhookDispatcher.dispatchEvent(tenantId, 'automation.triggered', { record, webhookId });
  } else {
    console.warn(`[Automation Action] Webhook ID '${webhookId}' would be triggered, but the 'webhookDispatcher' module does not exist yet.`);
  }
}

module.exports = { handle };
