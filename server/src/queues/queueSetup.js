const { Queue } = require('bullmq');
const env = require('../config/env');

const isServerless = !!process.env.VERCEL || process.env.NODE_ENV === 'production';
const useRedis = !!env.redisUrl && env.redisUrl !== 'redis://localhost:6379' && !isServerless;

const connection = {
  url: env.redisUrl || 'redis://localhost:6379',
  maxRetriesPerRequest: null,
  retryStrategy: (times) => Math.min(times * 500, 5000)
};

const mockQueue = (name) => ({
  add: async (jobName, _data, _opts) => console.log(`[Mock Queue ${name}] Job skipped in serverless mode: ${jobName}`)
});

const createQueue = (name) => {
  if (!useRedis) {
    return mockQueue(name);
  }
  try {
    return new Queue(name, { connection });
  } catch (error) {
    console.warn(`[QueueSetup] Defaulting queue ${name} to mock mode:`, error.message);
    return mockQueue(name);
  }
};

const aiQueue = createQueue('AI_Queue');
const notificationQueue = createQueue('Notification_Queue');
const scoreQueue = createQueue('Score_Queue');
const cronQueue = createQueue('Cron_Queue');

if (useRedis) {
  try {
    scoreQueue.add('decay_scores', {}, { repeat: { every: 12 * 60 * 60 * 1000 } }).catch(() => {});
    cronQueue.add('sla_check', {}, { repeat: { every: 60 * 60 * 1000 } }).catch(() => {});
    cronQueue.add('delay_escalation', {}, { repeat: { every: 60 * 60 * 1000 } }).catch(() => {});
    cronQueue.add('task_escalation', {}, { repeat: { every: 60 * 60 * 1000 } }).catch(() => {});
    cronQueue.add('amc_alert', {}, { repeat: { every: 12 * 60 * 60 * 1000 } }).catch(() => {});
    cronQueue.add('payment_reminder', {}, { repeat: { every: 12 * 60 * 60 * 1000 } }).catch(() => {});
    cronQueue.add('weekly_progress_report', {}, { repeat: { pattern: '0 17 * * 5' } }).catch(() => {});
    cronQueue.add('temp_permission_check', {}, { repeat: { every: 60 * 60 * 1000 } }).catch(() => {});
  } catch (error) {
    console.warn('[QueueSetup] Skipping background cron registration:', error.message);
  }
}

module.exports = {
  connection,
  useRedis,
  aiQueue,
  notificationQueue,
  scoreQueue,
  cronQueue
};
