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

console.log('[NotificationService] Subscribed to EventBus events');
