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
      add: async (jobName, _data, _opts) => console.log(`[Mock Queue ${name}] Added job: ${jobName}`)
    };
  }
  return new Queue(name, { connection });
};

const aiQueue = createQueue('AI_Queue');
const notificationQueue = createQueue('Notification_Queue');
const scoreQueue = createQueue('Score_Queue');
const cronQueue = createQueue('Cron_Queue');

if (useRedis) {
  // Schedule the score decay job to run every 12 hours (43200000 ms)
  scoreQueue.add('decay_scores', {}, {
    repeat: {
      every: 12 * 60 * 60 * 1000 // 12 hours
    }
  }).catch(e => console.error('Failed to schedule decay_scores', e.message));

  // Schedule Cron Jobs
  cronQueue.add('sla_check', {}, { repeat: { every: 60 * 60 * 1000 } }).catch(e => console.error('Failed to schedule sla_check', e.message));
  cronQueue.add('delay_escalation', {}, { repeat: { every: 60 * 60 * 1000 } }).catch(e => console.error('Failed to schedule delay_escalation', e.message));
  cronQueue.add('task_escalation', {}, { repeat: { every: 60 * 60 * 1000 } }).catch(e => console.error('Failed to schedule task_escalation', e.message));
  cronQueue.add('amc_alert', {}, { repeat: { every: 12 * 60 * 60 * 1000 } }).catch(e => console.error('Failed to schedule amc_alert', e.message));
  cronQueue.add('payment_reminder', {}, { repeat: { every: 12 * 60 * 60 * 1000 } }).catch(e => console.error('Failed to schedule payment_reminder', e.message));
  cronQueue.add('weekly_progress_report', {}, { repeat: { pattern: '0 17 * * 5' } }).catch(e => console.error('Failed to schedule weekly_progress_report', e.message));
}

module.exports = {
  connection,
  useRedis,
  aiQueue,
  notificationQueue,
  scoreQueue,
  cronQueue
};
