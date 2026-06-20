const { Queue } = require('bullmq');
const env = require('../config/env');

const useRedis = !!env.redisUrl && env.redisUrl !== 'redis://localhost:6379';

const connection = {
  url: env.redisUrl || 'redis://localhost:6379',
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 500, 5000)
};

const createQueue = (name) => {
  if (!useRedis) {
    return {
      add: async (jobName, data, opts) => console.log(`[Mock Queue ${name}] Added job: ${jobName}`)
    };
  }
  return new Queue(name, { connection });
};

const aiQueue = createQueue('AI_Queue');
const notificationQueue = createQueue('Notification_Queue');
const scoreQueue = createQueue('Score_Queue');

if (useRedis) {
  // Schedule the score decay job to run every 12 hours (43200000 ms)
  scoreQueue.add('decay_scores', {}, {
    repeat: {
      every: 12 * 60 * 60 * 1000 // 12 hours
    }
  }).catch(e => console.error('Failed to schedule decay_scores', e.message));
}

module.exports = {
  connection,
  useRedis,
  aiQueue,
  notificationQueue,
  scoreQueue
};
