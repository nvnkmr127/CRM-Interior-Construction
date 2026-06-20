const { Queue } = require('bullmq');
const env = require('../config/env');

const connection = {
  url: env.redisUrl || 'redis://localhost:6379'
};

const aiQueue = new Queue('AI_Queue', { connection });
const notificationQueue = new Queue('Notification_Queue', { connection });

const scoreQueue = new Queue('Score_Queue', { connection });

// Schedule the score decay job to run every 12 hours (43200000 ms)
scoreQueue.add('decay_scores', {}, {
  repeat: {
    every: 12 * 60 * 60 * 1000 // 12 hours
  }
});

module.exports = {
  connection,
  aiQueue,
  notificationQueue,
  scoreQueue
};
