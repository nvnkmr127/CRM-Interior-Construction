const pool = require('../../config/db');
const eventBus = require('../../utils/eventBus');
const serviceTicketService = require('../postSale/serviceTicketService');
const paymentReminderService = require('../projects/paymentReminderService');
const warrantyReminderService = require('../postSale/warrantyReminderService');
const documentReminderService = require('../projects/documentReminderService');
const { notifyUser } = require('../notificationService');

class SLAEngine {
  /**
   * Scans the database for SLA breaches and emits events.
   * This should ideally be called by a cron job periodically (e.g. every hour).
   */
  async checkSLABreaches() {
    try {
      console.log('[SLA Engine] Starting SLA breach check...');
      
      // 1. Check Leads for SLA Breach (No contact/follow-up in 48 hours for 'new' or 'active' leads)
      // We look at the 'updated_at' or 'last_contacted' vs current time.
      const leadQuery = `
        SELECT id, tenant_id, name, assignee_id, stage_id, updated_at 
        FROM leads 
        WHERE status = 'active' 
        AND updated_at < NOW() - INTERVAL '48 hours'
        AND id NOT IN (
          -- Do not escalate again if recently escalated in the last 24 hours
          SELECT entity_id FROM audit_logs 
          WHERE entity = 'lead' AND action = 'sla_breach' AND created_at > NOW() - INTERVAL '24 hours'
        )
      `;
      const leadRes = await pool.query(leadQuery);
      
      for (const lead of leadRes.rows) {
        console.log(`[SLA Engine] Lead ${lead.id} breached SLA.`);
        // Log the breach
        await pool.query(`
          INSERT INTO audit_logs (tenant_id, entity, entity_id, action, new_value)
          VALUES ($1, 'lead', $2, 'sla_breach', 'Lead untouched for 48 hours')
        `, [lead.tenant_id, lead.id]);
        
        eventBus.emit('lead.sla_breached', {
          tenantId: lead.tenant_id,
          lead: lead,
          reason: 'Untouched for 48 hours'
        });
      }

      // 2. Check Project Milestones for SLA Breach (Past Due Date)
      const milestoneQuery = `
        SELECT m.id, m.tenant_id, m.name, m.due_date, p.id as project_id, p.pm_id
        FROM milestones m
        JOIN project_phases ph ON m.phase_id = ph.id
        JOIN projects p ON ph.project_id = p.id
        WHERE m.status != 'completed' 
        AND m.due_date < NOW()
        AND m.id NOT IN (
          SELECT entity_id FROM audit_logs 
          WHERE entity = 'milestone' AND action = 'sla_breach' AND created_at > NOW() - INTERVAL '24 hours'
        )
      `;
      const milestoneRes = await pool.query(milestoneQuery);
      
      for (const milestone of milestoneRes.rows) {
        console.log(`[SLA Engine] Milestone ${milestone.id} breached SLA (Overdue).`);
        await pool.query(`
          INSERT INTO audit_logs (tenant_id, entity, entity_id, action, new_value)
          VALUES ($1, 'milestone', $2, 'sla_breach', 'Milestone overdue past due date')
        `, [milestone.tenant_id, milestone.id]);

        eventBus.emit('project.milestone_overdue', {
          tenantId: milestone.tenant_id,
          milestone: milestone,
          reason: 'Past Due Date'
        });
      }

      // 3. Check Tasks for SLA Breach (Overdue Tasks)
      const taskQuery = `
        SELECT t.id, t.tenant_id, t.title, t.due_date, t.project_id, p.pm_id
        FROM tasks t
        JOIN projects p ON t.project_id = p.id
        WHERE t.status != 'done' AND t.deleted_at IS NULL
        AND t.due_date < NOW()
        AND t.id NOT IN (
          SELECT entity_id FROM audit_logs 
          WHERE entity = 'task' AND action = 'sla_breach' AND created_at > NOW() - INTERVAL '24 hours'
        )
      `;
      const taskRes = await pool.query(taskQuery);

      for (const task of taskRes.rows) {
        console.log(`[SLA Engine] Task ${task.id} breached SLA (Overdue).`);
        await pool.query(`
          INSERT INTO audit_logs (tenant_id, entity, entity_id, action, new_value)
          VALUES ($1, 'task', $2, 'sla_breach', 'Task overdue past due date')
        `, [task.tenant_id, task.id]);

        eventBus.emit('project.task_overdue', {
          tenantId: task.tenant_id,
          task: task,
          reason: 'Past Due Date'
        });
      }

      // 4. Check Service Tickets for SLA Breach (due_date passed and status is not resolved or closed)
      const ticketQuery = `
        SELECT t.id, t.tenant_id, t.ticket_number, t.title, t.due_date, t.project_id
        FROM service_tickets t
        WHERE t.status NOT IN ('resolved', 'closed')
        AND t.due_date < NOW()
        AND t.id NOT IN (
          SELECT entity_id FROM audit_logs 
          WHERE entity = 'service_ticket' AND action = 'sla_breach' AND created_at > NOW() - INTERVAL '24 hours'
        )
      `;
      const ticketRes = await pool.query(ticketQuery);

      for (const ticket of ticketRes.rows) {
        console.log(`[SLA Engine] Service Ticket ${ticket.ticket_number} (${ticket.id}) breached SLA.`);
        await pool.query(`
          INSERT INTO audit_logs (tenant_id, entity, entity_id, action, new_value)
          VALUES ($1, 'service_ticket', $2, 'sla_breach', 'Service ticket overdue past due date')
        `, [ticket.tenant_id, ticket.id]);

        eventBus.emit('service_ticket.sla_breached', {
          tenantId: ticket.tenant_id,
          ticket: ticket,
          reason: 'Overdue past due date'
        });
      }

      // 5. Send Pre-visit Reminder Notifications for service visits scheduled in the next 24 hours
      const remindersSent = await serviceTicketService.sendPreVisitReminders();

      // 6. Run service ticket automatic SLA escalations
      const escalationsApplied = await serviceTicketService.checkAutomaticEscalations();

      // 7. Send payment reminders to clients (7d before, on due date, 3d/7d/14d overdue)
      const paymentRemindersSent = await paymentReminderService.checkAndSendPaymentReminders();

      // 8. Send warranty expiry reminders to clients (60d and 30d before expiry)
      const warrantyRemindersSent = await warrantyReminderService.checkAndSendWarrantyExpiryReminders();

      // 9. Send document/design approval reminders to clients (48h and 72h pending)
      const documentRemindersSent = await documentReminderService.checkAndSendDocumentApprovalReminders();

      // 10. Check Snag SLAs (50%, 100%, 200%, 300%)
      await this.checkSnagSLAs();

      console.log(`[SLA Engine] SLA check complete. Found ${leadRes.rows.length} lead breaches, ${milestoneRes.rows.length} milestone breaches, ${taskRes.rows.length} task breaches, ${ticketRes.rows.length} service ticket breaches, applied ${escalationsApplied} escalations, sent ${remindersSent} visit reminders, sent ${paymentRemindersSent} payment reminders, sent ${warrantyRemindersSent} warranty expiry reminders, and sent ${documentRemindersSent} document reminders.`);
    } catch (error) {
      console.error('[SLA Engine] Error checking SLA breaches:', error);
    }
  }

  async checkSnagSLAs() {
    try {
      const snagQuery = `
        SELECT s.id, s.tenant_id, s.title, s.created_at, s.sla_hours, s.assignee_id, s.project_id, p.pm_id, p.name as project_name
        FROM snags s
        JOIN projects p ON s.project_id = p.id
        WHERE s.status NOT IN ('resolved', 'client_verified')
      `;
      const snagRes = await pool.query(snagQuery);

      for (const snag of snagRes.rows) {
        const slaHours = snag.sla_hours || 48;
        const hoursElapsed = (new Date() - new Date(snag.created_at)) / (1000 * 60 * 60);

        let thresholdAction = null;
        if (hoursElapsed >= slaHours * 3) {
          thresholdAction = 'snag_sla_300';
        } else if (hoursElapsed >= slaHours * 2) {
          thresholdAction = 'snag_sla_200';
        } else if (hoursElapsed >= slaHours) {
          thresholdAction = 'snag_sla_100';
        } else if (hoursElapsed >= slaHours * 0.5) {
          thresholdAction = 'snag_sla_50';
        }

        if (!thresholdAction) continue;

        // Check deduplication
        const checkQuery = `
          SELECT 1 FROM audit_logs
          WHERE tenant_id = $1 AND entity = 'snag' AND entity_id = $2 AND action = $3
          LIMIT 1
        `;
        const checkRes = await pool.query(checkQuery, [snag.tenant_id, snag.id, thresholdAction]);

        if (checkRes.rowCount === 0) {
          console.log(`[SLA Engine] Snag ${snag.id} reached threshold ${thresholdAction}.`);

          let message = '';
          const usersToNotify = new Set();
          
          if (thresholdAction === 'snag_sla_50') {
            message = `SLA Alert (50%): Snag "${snag.title}" in project "${snag.project_name}" has reached 50% of its SLA.`;
            if (snag.assignee_id) usersToNotify.add(snag.assignee_id);
          } else if (thresholdAction === 'snag_sla_100') {
            message = `SLA Breach (100%): Snag "${snag.title}" in project "${snag.project_name}" has breached its SLA.`;
            if (snag.assignee_id) usersToNotify.add(snag.assignee_id);
            if (snag.pm_id) usersToNotify.add(snag.pm_id);
          } else if (thresholdAction === 'snag_sla_200') {
            message = `SLA Escalation (200%): Snag "${snag.title}" in project "${snag.project_name}" is heavily overdue. Escalated to Operations.`;
            if (snag.assignee_id) usersToNotify.add(snag.assignee_id);
            if (snag.pm_id) usersToNotify.add(snag.pm_id);
            
            // Get Operations Head
            const opsRes = await pool.query(`
              SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
              WHERE u.tenant_id = $1 AND (r.name ILIKE '%operations%' OR r.name ILIKE '%director%')
            `, [snag.tenant_id]);
            for (const row of opsRes.rows) usersToNotify.add(row.id);

          } else if (thresholdAction === 'snag_sla_300') {
            message = `CRITICAL SLA Breach (300%): Snag "${snag.title}" in project "${snag.project_name}" requires immediate Management Review.`;
            if (snag.assignee_id) usersToNotify.add(snag.assignee_id);
            if (snag.pm_id) usersToNotify.add(snag.pm_id);
            
            // Get Management and Operations
            const mgmtRes = await pool.query(`
              SELECT u.id FROM users u JOIN roles r ON u.role_id = r.id
              WHERE u.tenant_id = $1 AND (r.name IN ('gm', 'manager', 'director') OR r.name ILIKE '%operations%')
            `, [snag.tenant_id]);
            for (const row of mgmtRes.rows) usersToNotify.add(row.id);
          }

          // Notify resolved users
          for (const userId of usersToNotify) {
            notifyUser({
              tenantId: snag.tenant_id,
              userId,
              type: thresholdAction,
              message,
              referenceUrl: `/projects/${snag.project_id}/snags`
            });
          }

          // Log action
          await pool.query(`
            INSERT INTO audit_logs (tenant_id, entity, entity_id, action, new_value)
            VALUES ($1, 'snag', $2, $3, $4)
          `, [snag.tenant_id, snag.id, thresholdAction, JSON.stringify({ hoursElapsed, message })]);

          eventBus.emit('snag.sla_escalated', {
            tenantId: snag.tenant_id,
            snag,
            level: thresholdAction
          });
        }
      }
    } catch (err) {
      console.error('[SLA Engine] Error checking Snag SLAs:', err);
    }
  }
}

module.exports = new SLAEngine();
