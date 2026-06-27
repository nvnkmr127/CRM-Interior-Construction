const pool = require('../../db/pool');
const { notifyUser } = require('../notificationService');
const { sendWhatsAppMessage } = require('../whatsappService');
const { notificationQueue } = require('../../queues/queueSetup');
const eventBus = require('../../utils/eventBus');

/**
 * Checks approaching and overdue payment milestones, sending automated reminders.
 * Returns the count of reminders sent.
 */
async function checkAndSendPaymentReminders(projectId = null) {
  let remindersSent = 0;
  
  try {
    // 1. Fetch all unpaid, non-deferred milestones with a due date
    let query = `
      SELECT 
        pm.id, pm.tenant_id, pm.project_id, pm.name as milestone_name, pm.amount, pm.due_date, pm.status,
        p.name as project_name, p.client_name, p.client_email, p.client_phone, p.pm_id
      FROM payment_milestones pm
      JOIN projects p ON pm.project_id = p.id
      WHERE pm.status != 'paid' 
        AND pm.is_deferred = false 
        AND pm.due_date IS NOT NULL
        AND p.deleted_at IS NULL
    `;
    const params = [];
    if (projectId) {
      query += ` AND pm.project_id = $1`;
      params.push(projectId);
    }
    const { rows } = await pool.query(query, params);
    
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const milestone of rows) {
      const dueDate = new Date(milestone.due_date);
      dueDate.setHours(0, 0, 0, 0);
      
      const diffTime = dueDate.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));
      
      let reminderType = null;
      let emailMessage = null;
      let waMessage = null;
      let pmMessage = null;
      const dueDateStr = milestone.due_date instanceof Date 
        ? milestone.due_date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : new Date(milestone.due_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

      const amountFormatted = milestone.amount ? Number(milestone.amount).toLocaleString('en-IN') : 'N/A';

      if (diffDays === 7) {
        reminderType = '7_days_before';
        emailMessage = `Dear ${milestone.client_name},\n\nThis is a friendly reminder that the payment milestone "${milestone.milestone_name}" for your project "${milestone.project_name}" is due in 7 days on ${dueDateStr}.\nAmount Due: INR ${amountFormatted}.\n\nPlease ensure timely payment to keep the project on track.\n\nBest regards,\nCRM Finance Team`;
        waMessage = `Friendly reminder: The payment milestone "${milestone.milestone_name}" for project "${milestone.project_name}" is due on ${dueDateStr}. Amount: INR ${amountFormatted}. Please ensure timely payment.`;
        pmMessage = `Friendly payment reminder (7 days before) has been sent to client ${milestone.client_name} for milestone "${milestone.milestone_name}".`;
      } else if (diffDays === 0) {
        reminderType = 'due_date';
        emailMessage = `Dear ${milestone.client_name},\n\nThis is a reminder that the payment milestone "${milestone.milestone_name}" for your project "${milestone.project_name}" is due today, ${dueDateStr}.\nAmount Due: INR ${amountFormatted}.\n\nPlease process the payment at your earliest convenience.\n\nBest regards,\nCRM Finance Team`;
        waMessage = `Reminder: The payment milestone "${milestone.milestone_name}" for project "${milestone.project_name}" is due today. Amount: INR ${amountFormatted}. Please process payment at your earliest convenience.`;
        pmMessage = `Payment reminder (due date) has been sent to client ${milestone.client_name} for milestone "${milestone.milestone_name}".`;
      } else if (diffDays === -3) {
        reminderType = '3_days_overdue';
        emailMessage = `Dear ${milestone.client_name},\n\nThis is a follow-up that the payment milestone "${milestone.milestone_name}" for your project "${milestone.project_name}" is now overdue by 3 days. It was due on ${dueDateStr}.\nAmount Due: INR ${amountFormatted}.\n\nPlease process the payment immediately to prevent project disruptions.\n\nBest regards,\nCRM Finance Team`;
        waMessage = `Overdue notice: The payment milestone "${milestone.milestone_name}" for project "${milestone.project_name}" is 3 days overdue. Due date was ${dueDateStr}. Amount: INR ${amountFormatted}. Please process immediately.`;
        pmMessage = `Overdue payment reminder (3 days overdue) has been sent to client ${milestone.client_name} for milestone "${milestone.milestone_name}".`;
      } else if (diffDays === -7) {
        reminderType = '7_days_overdue';
        emailMessage = `Dear ${milestone.client_name},\n\nThis is an urgent reminder that the payment milestone "${milestone.milestone_name}" for your project "${milestone.project_name}" is overdue by 7 days (due date: ${dueDateStr}).\nAmount Due: INR ${amountFormatted}.\n\nPlease clear the outstanding amount immediately to avoid any delays in project execution.\n\nBest regards,\nCRM Finance Team`;
        waMessage = `Urgent notice: The payment milestone "${milestone.milestone_name}" for project "${milestone.project_name}" is 7 days overdue. Due date was ${dueDateStr}. Amount: INR ${amountFormatted}. Please clear the outstanding amount immediately.`;
        pmMessage = `Urgent payment reminder (7 days overdue) has been sent to client ${milestone.client_name} for milestone "${milestone.milestone_name}".`;
      } else if (diffDays === -14) {
        reminderType = '14_days_overdue';
        emailMessage = `Dear ${milestone.client_name},\n\nThis is a critical reminder that the payment milestone "${milestone.milestone_name}" for your project "${milestone.project_name}" is now overdue by 14 days.\nDue Date: ${dueDateStr}\nAmount Due: INR ${amountFormatted}.\n\nPlease clear the outstanding dues immediately. Failure to resolve this may lead to work suspension on your site.\n\nBest regards,\nCRM Finance Team`;
        waMessage = `Critical notice: The payment milestone "${milestone.milestone_name}" for project "${milestone.project_name}" is 14 days overdue. Amount: INR ${amountFormatted}. Please clear dues immediately to avoid work suspension.`;
        pmMessage = `Critical payment reminder (14 days overdue) has been sent to client ${milestone.client_name} for milestone "${milestone.milestone_name}".`;
      }

      if (reminderType) {
        // 2. Check if reminder already sent for this milestone & type
        const checkQuery = `
          SELECT 1 FROM audit_logs
          WHERE entity = 'payment_milestone'
            AND entity_id = $1
            AND action = 'payment_reminder'
            AND new_value = $2
          LIMIT 1
        `;
        const checkRes = await pool.query(checkQuery, [milestone.id, reminderType]);
        
        if (checkRes.rowCount === 0) {
          console.log(`[Payment Reminder] Sending "${reminderType}" reminder for milestone "${milestone.milestone_name}" (${milestone.id})`);
          
          // A. Send Email (via Notification Queue if client_email is present)
          if (milestone.client_email) {
            await notificationQueue.add('paymentReminderNotification', {
              type: 'email',
              recipientId: milestone.client_name,
              email: milestone.client_email,
              message: emailMessage
            });
          }
          
          // B. Send WhatsApp message (if client_phone is present)
          if (milestone.client_phone) {
            try {
              await sendWhatsAppMessage(milestone.client_phone, waMessage);
            } catch (err) {
              console.error(`[Payment Reminder] Failed to send WhatsApp to ${milestone.client_phone}:`, err.message);
            }
          }
          
          // C. Notify Project Manager (in-app notification)
          if (milestone.pm_id) {
            notifyUser({
              tenantId: milestone.tenant_id,
              userId: milestone.pm_id,
              type: 'payment_reminder',
              message: pmMessage,
              referenceUrl: `/projects/${milestone.project_id}/billing`
            });
          }
          
          // D. Log to audit_logs (to prevent duplicate reminders)
          await pool.query(`
            INSERT INTO audit_logs (tenant_id, action, entity, entity_id, new_value)
            VALUES ($1, 'payment_reminder', 'payment_milestone', $2, $3)
          `, [milestone.tenant_id, milestone.id, reminderType]);
          
          // E. Emit Event on eventBus
          eventBus.emit('payment_milestone.reminder_sent', {
            tenantId: milestone.tenant_id,
            milestoneId: milestone.id,
            reminderType,
            clientName: milestone.client_name,
            clientEmail: milestone.client_email,
            clientPhone: milestone.client_phone,
            message: emailMessage
          });

          remindersSent++;
        }
      }
    }
  } catch (error) {
    console.error('[Payment Reminder Service] Error checking and sending payment reminders:', error);
  }
  
  return remindersSent;
}

module.exports = {
  checkAndSendPaymentReminders
};
