const pool = require('../../db/pool');
const { notifyUser } = require('../notificationService');
const { sendWhatsAppMessage } = require('../whatsappService');
const { notificationQueue } = require('../../queues/queueSetup');
const eventBus = require('../../utils/eventBus');

/**
 * Retrieves the user ID for Operations Head.
 */
async function getOperationsHead(tenantId) {
  try {
    const { rows } = await pool.query(`
      SELECT u.id 
      FROM users u
      JOIN roles r ON u.role_id = r.id
      WHERE u.tenant_id = $1 AND (r.name ILIKE '%operations%' OR r.name ILIKE '%director%')
      LIMIT 1
    `, [tenantId]);
    return rows.length > 0 ? rows[0].id : null;
  } catch (error) {
    console.error('[Document Reminder] Error fetching Operations Head:', error);
    return null;
  }
}

/**
 * Checks for shared documents pending review and alerts clients if pending for >= 48h, 72h, or 120h.
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

      if (diffHours >= 120) {
        reminderType = '120_hours_reminder';
      } else if (diffHours >= 72) {
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

          let emailMessage = '';
          let waMessage = '';
          let pmMessage = `Document approval reminder (${reminderType}) sent to client ${d.client_name} for "${d.document_name}" (Project: "${d.project_name}").`;

          if (reminderType === '48_hours_reminder') {
            emailMessage = `Dear ${d.client_name},\n\nThis is a friendly reminder that the document/design "${d.document_name}" for project "${d.project_name}" is pending your review and approval.\n\nPlease log in to your Client Portal to review and approve it. Keeping designs approved on time helps us prevent project timeline delays.\n\nBest regards,\nCRM Project Team`;
            waMessage = `Approval Reminder: The document "${d.document_name}" for project "${d.project_name}" is pending your approval. Please review it on the Client Portal to avoid project delays.`;
          } else if (reminderType === '72_hours_reminder') {
            emailMessage = `Dear ${d.client_name},\n\nThis is a follow-up reminder that the document/design "${d.document_name}" for project "${d.project_name}" has been pending your approval for 3 days.\n\nYour prompt review is essential to maintain the project schedule. Please log in to your Client Portal to provide your feedback or approval.\n\nBest regards,\nCRM Project Team`;
            waMessage = `Follow-up Reminder: The document "${d.document_name}" for project "${d.project_name}" has been pending your approval for 3 days. Please review it promptly.`;
          } else if (reminderType === '120_hours_reminder') {
            emailMessage = `Dear ${d.client_name},\n\nThis is an urgent reminder that the document/design "${d.document_name}" for project "${d.project_name}" has been pending your approval for 5 days.\n\nExtended delays in design approval directly impact the overall project timeline. Please log in to your Client Portal to review and approve it immediately.\n\nBest regards,\nCRM Project Team`;
            waMessage = `Urgent Reminder: The document "${d.document_name}" for project "${d.project_name}" has been pending your approval for 5 days. Please review it immediately to prevent timeline delays.`;
            pmMessage = `URGENT: Document approval for "${d.document_name}" (Project: "${d.project_name}") has been pending for 5 days. This has been escalated to Operations.`;
          }

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

          // C. Notify internal stakeholders based on escalation
          if (reminderType === '72_hours_reminder' || reminderType === '120_hours_reminder') {
            if (d.pm_id) {
              notifyUser({
                tenantId: d.tenant_id,
                userId: d.pm_id,
                type: 'document_approval_reminder',
                message: pmMessage,
                referenceUrl: `/projects/${d.project_id}?tab=Documents`
              });
            }
          }
          
          if (reminderType === '120_hours_reminder') {
            const opsHeadId = await getOperationsHead(d.tenant_id);
            if (opsHeadId) {
              notifyUser({
                tenantId: d.tenant_id,
                userId: opsHeadId,
                type: 'document_approval_reminder',
                message: `Escalation: Design approval for "${d.document_name}" in project "${d.project_name}" has been pending for 5 days.`,
                referenceUrl: `/projects/${d.project_id}?tab=Documents`
              });
            }
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
