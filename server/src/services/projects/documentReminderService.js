const pool = require('../../db/pool');
const { notifyUser } = require('../notificationService');
const { sendWhatsAppMessage } = require('../whatsappService');
const { notificationQueue } = require('../../queues/queueSetup');
const eventBus = require('../../utils/eventBus');

/**
 * Checks for shared documents pending review and alerts clients if pending for >= 48h or 72h.
 * Returns the count of reminders sent.
 */
async function checkAndSendDocumentApprovalReminders(projectId = null) {
  let remindersSent = 0;

  try {
    let query = `
      SELECT 
        d.id, d.tenant_id, d.project_id, d.name as document_name, d.status, d.created_at,
        p.name as project_name, p.client_name, p.client_email, p.client_phone, p.pm_id,
        u.name as pm_name
      FROM documents d
      JOIN projects p ON d.project_id = p.id
      LEFT JOIN users u ON p.pm_id = u.id
      WHERE d.status = 'pending_review'
        AND d.is_visible_to_client = true
        AND p.deleted_at IS NULL
    `;
    const params = [];
    if (projectId) {
      query += ` AND d.project_id = $1`;
      params.push(projectId);
    }

    const { rows } = await pool.query(query, params);
    const now = new Date();

    for (const d of rows) {
      const createdDate = new Date(d.created_at);
      const diffMs = now.getTime() - createdDate.getTime();
      const diffHours = diffMs / (1000 * 60 * 60);

      let reminderType = null;

      if (diffHours >= 72) {
        reminderType = '72_hours_reminder';
      } else if (diffHours >= 48) {
        reminderType = '48_hours_reminder';
      }

      if (reminderType) {
        // Check if this type of reminder was already sent
        const checkQuery = `
          SELECT 1 FROM audit_logs
          WHERE entity = 'document'
            AND entity_id = $1
            AND action = 'document_approval_reminder'
            AND new_value = $2
          LIMIT 1
        `;
        const checkRes = await pool.query(checkQuery, [d.id, reminderType]);

        if (checkRes.rowCount === 0) {
          console.log(`[Document Approval Reminder] Sending "${reminderType}" alert for document "${d.document_name}" (${d.id})`);

          const emailMessage = `Dear ${d.client_name},\n\nThis is a friendly reminder that the document/design "${d.document_name}" for project "${d.project_name}" is pending your review and approval.\n\nPlease log in to your Client Portal to review and approve it. Keeping designs approved on time helps us prevent project timeline delays.\n\nBest regards,\nCRM Project Team`;
          const waMessage = `Approval Reminder: The document "${d.document_name}" for project "${d.project_name}" is pending your approval. Please review it on the Client Portal to avoid project delays.`;
          const pmMessage = `Document approval reminder (${reminderType}) sent to client ${d.client_name} for "${d.document_name}" (Project: "${d.project_name}").`;

          // A. Send Email to client
          if (d.client_email) {
            await notificationQueue.add('documentApprovalNotification', {
              type: 'email',
              recipientId: d.client_name,
              email: d.client_email,
              message: emailMessage
            });
          }

          // B. Send WhatsApp to client
          if (d.client_phone) {
            try {
              await sendWhatsAppMessage(d.client_phone, waMessage);
            } catch (err) {
              console.error(`[Document Approval Reminder] Failed to send WhatsApp:`, err.message);
            }
          }

          // C. Notify PM In-App
          if (d.pm_id) {
            notifyUser({
              tenantId: d.tenant_id,
              userId: d.pm_id,
              type: 'document_approval_reminder',
              message: pmMessage,
              referenceUrl: `/projects/${d.project_id}?tab=Documents`
            });
          }

          // D. Log to audit_logs
          await pool.query(`
            INSERT INTO audit_logs (tenant_id, action, entity, entity_id, new_value)
            VALUES ($1, 'document_approval_reminder', 'document', $2, $3)
          `, [d.tenant_id, d.id, reminderType]);

          // E. Emit EventBus
          eventBus.emit('document.approval_reminder_sent', {
            tenantId: d.tenant_id,
            documentId: d.id,
            reminderType,
            clientName: d.client_name,
            clientEmail: d.client_email,
            clientPhone: d.client_phone,
            message: emailMessage
          });

          remindersSent++;
        }
      }
    }
  } catch (error) {
    console.error('[Document Reminder Service] Error in checkAndSendDocumentApprovalReminders:', error);
  }

  return remindersSent;
}

module.exports = {
  checkAndSendDocumentApprovalReminders
};
