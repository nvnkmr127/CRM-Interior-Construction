const sendWhatsapp = require('./handlers/sendWhatsapp');
const sendEmail = require('./handlers/sendEmail');
const createTaskAction = require('./handlers/createTaskAction');
const updateField = require('./handlers/updateField');
const assignUser = require('./handlers/assignUser');
const callWebhook = require('./handlers/callWebhook');

/**
 * Dispatches an automation action to its respective handler module.
 * Wraps execution inside a non-fatal try/catch to ensure the broader automation run 
 * isn't forcibly aborted if a single discrete action errors out.
 * 
 * @param {Object} action - The action definition payload { type, config }
 * @param {Object} context - The execution context boundary { tenantId, userId: 'system', record, triggeredBy }
 */
async function executeAction(action, context) {
  try {
    switch (action.type) {
      case 'send_whatsapp':
        await sendWhatsapp.handle(action.config, context);
        break;
      case 'send_email':
        await sendEmail.handle(action.config, context);
        break;
      case 'create_task':
        await createTaskAction.handle(action.config, context);
        break;
      case 'update_field':
        await updateField.handle(action.config, context);
        break;
      case 'assign_user':
        await assignUser.handle(action.config, context);
        break;
      case 'call_webhook':
        await callWebhook.handle(action.config, context);
        break;
      default:
        console.warn(`[Automation] Unknown action type explicitly bypassed: ${action.type}`);
    }
  } catch (error) {
    // Log prominently but NEVER throw; automation chains must remain resilient
    console.error(`[Automation Action Failure] Execution failed for type '${action.type}' (triggered by rule: ${context.triggeredBy}):`, error);
  }
}

module.exports = executeAction;
