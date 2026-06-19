const sendWhatsapp = require('./handlers/sendWhatsapp');
const sendEmail = require('./handlers/sendEmail');
const createTaskAction = require('./handlers/createTaskAction');
const updateField = require('./handlers/updateField');
const assignUser = require('./handlers/assignUser');
const callWebhook = require('./handlers/callWebhook');
const invokeAiAction = require('./handlers/invokeAiAction');
const createProjectAction = require('./handlers/createProjectAction');
const sendCalendarInvite = require('./handlers/sendCalendarInvite');

/**
 * Dispatches an automation action to its respective handler module.
 * Wraps execution inside a non-fatal try/catch to ensure the broader automation run 
 * isn't forcibly aborted if a single discrete action errors out.
 * 
 * @param {Object} action - The action definition payload { type, config }
 * @param {Object} context - The execution context boundary { tenantId, userId: 'system', record, triggeredBy }
 */
const pool = require('../../db/pool');

async function executeAction(action, context) {
  let eventId;
  const startTime = Date.now();
  try {
    // 1. Insert pending event
    const eventResult = await pool.query(`
      INSERT INTO automation_events (tenant_id, lead_id, workflow, action_type, status)
      VALUES ($1, $2, $3, $4, 'pending')
      RETURNING id
    `, [context.tenantId, context.record?.id || null, context.triggeredBy || 'unknown', action.type]);
    eventId = eventResult.rows[0].id;

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
      case 'invoke_ai':
        await invokeAiAction.handle(action.config, context);
        break;
      case 'create_project':
        await createProjectAction.handle(action.config, context);
        break;
      case 'send_calendar_invite':
        await sendCalendarInvite.handle(action.config, context);
        break;
      default:
        console.warn(`[Automation] Unknown action type explicitly bypassed: ${action.type}`);
    }

    // 2. Mark success
    const duration = Date.now() - startTime;
    await pool.query(`
      UPDATE automation_events SET status = 'success', duration_ms = $1 WHERE id = $2
    `, [duration, eventId]);

    // Also insert timeline event if it involves a lead
    if (context.record?.id) {
       await pool.query(`
         INSERT INTO lead_timeline (tenant_id, lead_id, event_type, summary)
         VALUES ($1, $2, 'automation.executed', $3)
       `, [context.tenantId, context.record.id, `Automation ran: ${action.type}`]);
    }

  } catch (error) {
    console.error(`[Automation Action Failure] Execution failed for type '${action.type}' (triggered by rule: ${context.triggeredBy}):`, error);
    if (eventId) {
      const duration = Date.now() - startTime;
      await pool.query(`
        UPDATE automation_events SET status = 'failed', duration_ms = $1, error_message = $2 WHERE id = $3
      `, [duration, error.message || 'Unknown error', eventId]);
    }
  }
}

module.exports = executeAction;
