const { Worker } = require('bullmq');
const { connection } = require('../queueSetup');

const notificationWorker = new Worker('Notification_Queue', async job => {
  const { type, _recipientId, _message } = job.data;
  console.log(`Processing Notification job: ${job.id} of type: ${type}`);

  if (type === 'email') {
    // await emailService.send(recipientId, message);
  } else if (type === 'push') {
    // await pushService.send(recipientId, message);
  }
}, { connection });

notificationWorker.on('completed', job => {
  console.log(`Notification Job ${job.id} has completed!`);
});

notificationWorker.on('failed', (job, err) => {
  console.error(`Notification Job ${job.id} has failed with ${err.message}`);
});

module.exports = notificationWorker;
