const eventBus = require('../../utils/eventBus');
const { notificationQueue } = require('../../queues/queueSetup');

// Subscribe to Lead events
eventBus.on('lead.stage_changed', async ({ _tenantId, userId, lead, _oldStage, newStage }) => {
  if (lead.assignee_id && lead.assignee_id !== userId) {
    await notificationQueue.add('stageChangeNotification', {
      type: 'in-app',
      recipientId: lead.assignee_id,
      message: `Lead '${lead.name}' moved to ${newStage.name}`,
    });
  }
});

eventBus.on('lead.assigned', async ({ _tenantId, lead, assigneeId }) => {
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

eventBus.on('task.escalated', async ({ _tenantId, task, targetUserId, targetLevel, hoursBlocked, pmId, delayAssessment }) => {
  try {
    const roles = {
      1: 'Project Manager',
      2: 'Operations Head',
      3: 'Business Head'
    };
    
    let message = `Escalation Alert (Level ${targetLevel}): Task '${task.title}' in project '${task.project_name}' has been blocked for over ${hoursBlocked} hours.`;
    if (delayAssessment) {
      message += `\nImpact Assessment: ${delayAssessment}`;
    }

    // Notify the target user
    await notificationQueue.add('taskEscalationNotification', {
      type: 'in-app',
      recipientId: targetUserId,
      message: message,
    });
    await notificationQueue.add('taskEscalationNotification', {
      type: 'email',
      recipientId: targetUserId,
      message: message,
    });

    console.log(`[NotificationHandler] Dispatched Escalation Level ${targetLevel} to user ${targetUserId} for task ${task.id}`);

    // If level 2 or 3, also notify the PM so they are aware
    if (targetLevel > 1 && pmId && pmId !== targetUserId) {
      const pmMessage = `FYI: Task '${task.title}' blocked for ${hoursBlocked} hours has been escalated to the ${roles[targetLevel]}.`;
      await notificationQueue.add('taskEscalationNotification', {
        type: 'in-app',
        recipientId: pmId,
        message: pmMessage,
      });
    }

  } catch (error) {
    console.error('[NotificationHandler] Error processing task.escalated:', error);
  }
});

console.log('[NotificationService] Subscribed to EventBus events');
