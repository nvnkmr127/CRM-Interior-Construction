const pool = require('../../config/db');
const eventBus = require('../../utils/eventBus');
const serviceTicketService = require('../postSale/serviceTicketService');
const paymentReminderService = require('../projects/paymentReminderService');
const warrantyReminderService = require('../postSale/warrantyReminderService');
const documentReminderService = require('../projects/documentReminderService');

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

      console.log(`[SLA Engine] SLA check complete. Found ${leadRes.rows.length} lead breaches, ${milestoneRes.rows.length} milestone breaches, ${taskRes.rows.length} task breaches, ${ticketRes.rows.length} service ticket breaches, applied ${escalationsApplied} escalations, sent ${remindersSent} visit reminders, sent ${paymentRemindersSent} payment reminders, sent ${warrantyRemindersSent} warranty expiry reminders, and sent ${documentRemindersSent} document reminders.`);
    } catch (error) {
      console.error('[SLA Engine] Error checking SLA breaches:', error);
    }
  }
}

module.exports = new SLAEngine();
