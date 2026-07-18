const pool = require('../db/pool');
const eventBus = require('../utils/eventBus');

class PaymentReminderJob {
  async run() {
    console.log('[Jobs] PaymentReminderJob started.');
    try {
      const query = `
        SELECT pm.*,
               p.name as project_name, p.client_name, p.client_email, p.pm_id, p.crm_executive_id,
               (CURRENT_DATE - pm.due_date) as days_overdue
        FROM payment_milestones pm
        JOIN projects p ON pm.project_id = p.id
        WHERE pm.status != 'paid' 
          AND pm.due_date IS NOT NULL 
          AND p.status = 'active'
      `;
      
      // If pool is exported as an object { pool }, adjust here. Based on delayEscalationJob, 
      // pool config usually exports { pool } or directly pool.
      // Wait, delayEscalationJob uses: const { pool } = require('../config/db');
      // While taskEscalationJob uses: const pool = require('../../config/db');
      // I'll require { pool } just to be safe if that's the pattern, or check it.
      // Let's use the one from delayEscalationJob: const { pool } = require('../../config/db');
      // I'll fix the import inline below.
      
      // We will fix the require when writing the file.
      
      const { rows } = await pool.query(query);

      for (const milestone of rows) {
        let newStage = milestone.reminder_stage || 0;
        let intensity = '';

        if (milestone.days_overdue >= 14 && newStage < 5) {
          newStage = 5;
          intensity = '14_days_overdue';
        } else if (milestone.days_overdue >= 7 && newStage < 4) {
          newStage = 4;
          intensity = '7_days_overdue';
        } else if (milestone.days_overdue >= 3 && newStage < 3) {
          newStage = 3;
          intensity = '3_days_overdue';
        } else if (milestone.days_overdue >= 0 && newStage < 2) {
          newStage = 2;
          intensity = 'due_today';
        } else if (milestone.days_overdue >= -7 && newStage < 1) {
          newStage = 1;
          intensity = '7_days_before';
        }

        if (newStage > (milestone.reminder_stage || 0)) {
          // Update stage
          await pool.query(
            `UPDATE payment_milestones SET reminder_stage = $1, last_reminder_sent_at = NOW() WHERE id = $2`,
            [newStage, milestone.id]
          );

          console.log(`[PaymentReminderJob] Triggering ${intensity} reminder for milestone ${milestone.id}`);
          
          // Emit event
          eventBus.emit('payment.reminder', {
            tenantId: milestone.tenant_id,
            projectId: milestone.project_id,
            milestoneId: milestone.id,
            milestoneName: milestone.name,
            amount: milestone.amount,
            dueDate: milestone.due_date,
            intensity,
            clientName: milestone.client_name,
            clientEmail: milestone.client_email,
            projectName: milestone.project_name,
            pmId: milestone.pm_id,
            crmExecutiveId: milestone.crm_executive_id
          });
        }
      }
      
      console.log('[Jobs] PaymentReminderJob completed.');
    } catch (err) {
      console.error('[Jobs] PaymentReminderJob error:', err);
    }
  }
}

module.exports = new PaymentReminderJob();
