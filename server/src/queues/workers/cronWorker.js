const { Worker } = require('bullmq');
const { connection, useRedis } = require('../queueSetup');
const slaEngine = require('../../services/workflows/slaEngine');
const delayEscalationJob = require('../../jobs/delayEscalationJob');
const taskEscalationJob = require('../../jobs/taskEscalationJob');
const amcService = require('../../services/postSale/amcService');
const paymentReminderJob = require('../../jobs/paymentReminderJob');
const weeklyProgressReportJob = require('../../jobs/weeklyProgressReportJob');

if (useRedis) {
  const cronWorker = new Worker('Cron_Queue', async (job) => {
    console.log(`[CronWorker] Processing job: ${job.name}`);
    
    try {
      switch (job.name) {
        case 'sla_check':
          await slaEngine.checkSLABreaches();
          break;
        case 'delay_escalation':
          await delayEscalationJob.run();
          break;
        case 'task_escalation':
          await taskEscalationJob.start();
          break;
        case 'amc_alert':
          await amcService.checkAndNotifyExpiredOrExpiringAMCs();
          break;
        case 'payment_reminder':
          await paymentReminderJob.run();
          break;
        case 'weekly_progress_report':
          await weeklyProgressReportJob.run();
          break;
        default:
          console.warn(`[CronWorker] Unknown job name: ${job.name}`);
      }
    } catch (error) {
      console.error(`[CronWorker] Error processing job ${job.name}:`, error);
      throw error;
    }
  }, { connection });

  cronWorker.on('completed', (job) => {
    console.log(`[CronWorker] Completed job ${job.id} (${job.name})`);
  });

  cronWorker.on('failed', (job, err) => {
    console.error(`[CronWorker] Job ${job.id} (${job.name}) failed:`, err);
  });
} else {
  console.log('[CronWorker] Redis is disabled, cronWorker not started.');
}
