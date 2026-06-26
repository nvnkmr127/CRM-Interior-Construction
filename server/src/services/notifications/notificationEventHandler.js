const eventBus = require('../../utils/eventBus');
const { notificationQueue } = require('../../queues/queueSetup');

// Subscribe to Lead events
eventBus.on('lead.stage_changed', async ({ tenantId, userId, lead, oldStage, newStage }) => {
  if (lead.assignee_id && lead.assignee_id !== userId) {
    await notificationQueue.add('stageChangeNotification', {
      type: 'in-app',
      recipientId: lead.assignee_id,
      message: `Lead '${lead.name}' moved to ${newStage.name}`,
    });
  }
});

eventBus.on('lead.assigned', async ({ tenantId, lead, assigneeId }) => {
  await notificationQueue.add('assignmentNotification', {
    type: 'email',
    recipientId: assigneeId,
    message: `You have been assigned a new lead: ${lead.name}`,
  });
});

eventBus.on('project.schedule_shifted', async ({ pmId, clientEmail, clientName, projectName, revisedCompletionDate, isBreached, overrunDays }) => {
  try {
    const formattedCompletion = new Date(revisedCompletionDate).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });
    
    let alertMessage = `Schedule cascade warning: Project '${projectName}' timeline has shifted due to delays. Revised estimated completion is ${formattedCompletion}.`;
    if (isBreached) {
      alertMessage += ` This breaches the target date by ${overrunDays} days.`;
    }

    if (pmId) {
      await notificationQueue.add('delayNotification', {
        type: 'in-app',
        recipientId: pmId,
        message: alertMessage,
      });
      console.log(`[NotificationHandler] Dispatched PM in-app alert for project ${projectName}`);
    }

    if (clientEmail) {
      await notificationQueue.add('delayNotification', {
        type: 'email',
        recipientId: pmId || clientName,
        email: clientEmail,
        message: `Dear ${clientName}, we want to keep you informed about the progress of your project '${projectName}'. Due to recent timeline adjustments, the revised projected completion date is now ${formattedCompletion}. Thank you for your understanding.`,
      });
      console.log(`[NotificationHandler] Dispatched client email alert to ${clientEmail} for project ${projectName}`);
    }
  } catch (error) {
    console.error('[NotificationHandler] Error processing project.schedule_shifted:', error);
  }
});

console.log('[NotificationService] Subscribed to EventBus events');
