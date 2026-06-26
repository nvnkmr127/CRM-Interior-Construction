const pool = require('../../config/db');
const eventBus = require('../../utils/eventBus');

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
          INSERT INTO audit_logs (tenant_id, entity, entity_id, action, details)
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
          INSERT INTO audit_logs (tenant_id, entity, entity_id, action, details)
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
          INSERT INTO audit_logs (tenant_id, entity, entity_id, action, details)
          VALUES ($1, 'task', $2, 'sla_breach', 'Task overdue past due date')
        `, [task.tenant_id, task.id]);

        eventBus.emit('project.task_overdue', {
          tenantId: task.tenant_id,
          task: task,
          reason: 'Past Due Date'
        });
      }

      console.log(`[SLA Engine] SLA check complete. Found ${leadRes.rows.length} lead breaches, ${milestoneRes.rows.length} milestone breaches, and ${taskRes.rows.length} task breaches.`);
    } catch (error) {
      console.error('[SLA Engine] Error checking SLA breaches:', error);
    }
  }
}

module.exports = new SLAEngine();
