const pool = require('../../db/pool');
const { notifyUser } = require('../notificationService');
const { sendWhatsAppMessage } = require('../whatsappService');
const { notificationQueue } = require('../../queues/queueSetup');
const eventBus = require('../../utils/eventBus');

/**
 * Checks approaching warranty expiries (at 90 and 30 days) and sends reminders with AMC offers.
 * Returns the count of reminders sent.
 */
async function checkAndSendWarrantyExpiryReminders(projectId = null) {
  let remindersSent = 0;

  try {
    // 1. Fetch active warranties with end dates
    let query = `
      SELECT 
        w.id, w.tenant_id, w.project_id, w.product_name, w.serial_number, w.brand, w.end_date, w.status,
        p.name as project_name, p.client_name, p.client_email, p.client_phone, p.pm_id,
        u.name as pm_name
      FROM warranties w
      JOIN projects p ON w.project_id = p.id
      LEFT JOIN users u ON p.pm_id = u.id
      WHERE w.status = 'active'
        AND w.end_date IS NOT NULL
        AND p.deleted_at IS NULL
    `;
    const params = [];
    if (projectId) {
      query += ` AND w.project_id = $1`;
      params.push(projectId);
    }
    const { rows } = await pool.query(query, params);

    const today = new Date();
    today.setHours(0, 0, 0, 0);

    for (const w of rows) {
      const endDate = new Date(w.end_date);
      endDate.setHours(0, 0, 0, 0);

      const diffTime = endDate.getTime() - today.getTime();
      const diffDays = Math.round(diffTime / (1000 * 60 * 60 * 24));

      let reminderType = null;
      let emailMessage = null;
      let waMessage = null;
      let pmMessage = null;
      
      const endDateStr = w.end_date instanceof Date
        ? w.end_date.toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' })
        : new Date(w.end_date).toLocaleDateString('en-IN', { day: 'numeric', month: 'short', year: 'numeric' });

      if (diffDays === 90) {
        reminderType = '90_days_before';
      } else if (diffDays === 30) {
        reminderType = '30_days_before';
      }

      if (reminderType) {
        emailMessage = `Dear ${w.client_name},\n\nThis is a friendly reminder that the warranty for your product "${w.product_name}" (Brand: ${w.brand || 'N/A'}, Serial: ${w.serial_number || 'N/A'}) under project "${w.project_name}" will expire in ${diffDays} days on ${endDateStr}.\n\nTo ensure continued maintenance support and peace of mind, we invite you to renew with our Annual Maintenance Contract (AMC) plans. Our AMC covers routine inspections, repair services, and priority support.\n\nPlease reply to this email or contact your Project Manager ${w.pm_name || 'CRM Support'} to secure your special AMC conversion offer!\n\nBest regards,\nCRM After-Sales Team`;
        waMessage = `Warranty Expiry Alert: The warranty for your product "${w.product_name}" under project "${w.project_name}" will expire on ${endDateStr} (${diffDays} days remaining). Reply to this message to secure your AMC renewal offer!`;
        pmMessage = `Warranty expiry alert (${diffDays} days before) sent to client ${w.client_name} for "${w.product_name}" (Project: "${w.project_name}"). Follow up for AMC conversion.`;

        // 2. Check if reminder was already sent for this warranty & type
        const checkQuery = `
          SELECT 1 FROM audit_logs
          WHERE entity = 'warranty'
            AND entity_id = $1
            AND action = 'warranty_expiry_reminder'
            AND new_value = $2
          LIMIT 1
        `;
        const checkRes = await pool.query(checkQuery, [w.id, reminderType]);

        if (checkRes.rowCount === 0) {
          console.log(`[Warranty Expiry Alert] Sending "${reminderType}" alert for warranty "${w.product_name}" (${w.id})`);

          // A. Send Email to client
          if (w.client_email) {
            await notificationQueue.add('warrantyExpiryNotification', {
              type: 'email',
              recipientId: w.client_name,
              email: w.client_email,
              message: emailMessage
            });
          }

          // B. Send WhatsApp message to client
          if (w.client_phone) {
            try {
              await sendWhatsAppMessage(w.client_phone, waMessage);
            } catch (err) {
              console.error(`[Warranty Expiry Alert] Failed to send WhatsApp to ${w.client_phone}:`, err.message);
            }
          }

          // C. Notify PM In-App
          if (w.pm_id) {
            notifyUser({
              tenantId: w.tenant_id,
              userId: w.pm_id,
              type: 'warranty_expiry_alert',
              message: pmMessage,
              referenceUrl: `/projects/${w.project_id}?tab=Warranties`
            });
          }

          // D. Log to audit_logs (to prevent duplicate reminders)
          await pool.query(`
            INSERT INTO audit_logs (tenant_id, action, entity, entity_id, new_value)
            VALUES ($1, 'warranty_expiry_reminder', 'warranty', $2, $3)
          `, [w.tenant_id, w.id, reminderType]);

          // E. Emit Event on eventBus
          eventBus.emit('warranty.expiry_reminder_sent', {
            tenantId: w.tenant_id,
            warrantyId: w.id,
            reminderType,
            clientName: w.client_name,
            clientEmail: w.client_email,
            clientPhone: w.client_phone,
            message: emailMessage
          });

          remindersSent++;
        }
      }
    }
  } catch (error) {
    console.error('[Warranty Reminder Service] Error checking and sending warranty expiry reminders:', error);
  }

  return remindersSent;
}

module.exports = {
  checkAndSendWarrantyExpiryReminders
};
