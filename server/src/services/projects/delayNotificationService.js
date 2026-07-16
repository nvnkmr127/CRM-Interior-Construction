const pool = require('../../db/pool');
const { notifyUser } = require('../notificationService');

class DelayNotificationService {
  /**
   * Auto-detect overdue milestones or project target dates and create draft delay notifications.
   * Sends an alert to the PM when a new draft is created.
   */
  async detectAndCreateDelayDrafts(tenantId, projectId) {
    const pmQuery = `SELECT pm_id FROM projects WHERE id = $1 AND tenant_id = $2`;
    const pmRes = await pool.query(pmQuery, [projectId, tenantId]);
    const pmId = pmRes.rows[0]?.pm_id;

    // 1. Scan for overdue milestones (due date in past and status not completed)
    const milestoneQuery = `
      SELECT m.id, m.name, m.due_date
      FROM milestones m
      JOIN project_phases p ON m.phase_id = p.id
      WHERE m.project_id = $1 AND m.tenant_id = $2 
        AND m.status != 'completed' AND m.due_date < CURRENT_DATE
    `;
    const milestones = await pool.query(milestoneQuery, [projectId, tenantId]);

    for (const m of milestones.rows) {
      // Check if a delay notification for this milestone and original_date already exists
      const checkQuery = `
        SELECT id FROM delay_notifications
        WHERE project_id = $1 AND tenant_id = $2 
          AND milestone_id = $3 AND original_date = $4
      `;
      const checkRes = await pool.query(checkQuery, [projectId, tenantId, m.id, m.due_date]);
      
      if (checkRes.rows.length === 0) {
        const revisedDate = new Date();
        revisedDate.setDate(revisedDate.getDate() + 7);
        const revisedDateStr = revisedDate.toISOString().split('T')[0];
        const origDateStr = new Date(m.due_date).toISOString().split('T')[0];

        const draftText = `Dear Client, we would like to inform you that the milestone "${m.name}" originally scheduled for completion on ${origDateStr} has been delayed. The revised expected completion date is now ${revisedDateStr}. Reason for delay: [Please specify the reason]. We apologize for the delay and appreciate your patience.`;

        const insertQuery = `
          INSERT INTO delay_notifications (
            tenant_id, project_id, milestone_id, type, original_date, revised_date, reason, message_draft, status
          )
          VALUES ($1, $2, $3, 'milestone_delay', $4, $5, 'Awaiting details', $6, 'draft')
          RETURNING id
        `;
        const _insertRes = await pool.query(insertQuery, [
          tenantId, projectId, m.id, m.due_date, revisedDateStr, draftText
        ]);

        if (pmId) {
          notifyUser({
            tenantId,
            userId: pmId,
            type: 'DELAY_DRAFT_CREATED',
            message: `Milestone "${m.name}" is overdue. Please raise a delay communication to the client within 24 hours.`,
            referenceUrl: `/projects/${projectId}/delays`
          });
        }
      }
    }

    // 2. Scan for overdue project target date
    const projectQuery = `
      SELECT id, name, target_date
      FROM projects
      WHERE id = $1 AND tenant_id = $2 
        AND status = 'active' AND target_date < CURRENT_DATE
    `;
    const projects = await pool.query(projectQuery, [projectId, tenantId]);

    if (projects.rows.length > 0) {
      const p = projects.rows[0];
      const checkQuery = `
        SELECT id FROM delay_notifications
        WHERE project_id = $1 AND tenant_id = $2 
          AND milestone_id IS NULL AND original_date = $3
      `;
      const checkRes = await pool.query(checkQuery, [projectId, tenantId, p.target_date]);
      
      if (checkRes.rows.length === 0) {
        const revisedDate = new Date();
        revisedDate.setDate(revisedDate.getDate() + 7);
        const revisedDateStr = revisedDate.toISOString().split('T')[0];
        const origDateStr = new Date(p.target_date).toISOString().split('T')[0];

        const draftText = `Dear Client, we would like to inform you that the final completion date for your project "${p.name}" originally scheduled for ${origDateStr} has been delayed. The revised expected completion date is now ${revisedDateStr}. Reason for delay: [Please specify the reason]. We apologize for the delay and appreciate your patience.`;

        const insertQuery = `
          INSERT INTO delay_notifications (
            tenant_id, project_id, milestone_id, type, original_date, revised_date, reason, message_draft, status
          )
          VALUES ($1, $2, NULL, 'project_delay', $3, $4, 'Awaiting details', $5, 'draft')
        `;
        await pool.query(insertQuery, [
          tenantId, projectId, p.target_date, revisedDateStr, draftText
        ]);

        if (pmId) {
          notifyUser({
            tenantId,
            userId: pmId,
            type: 'DELAY_DRAFT_CREATED',
            message: `Project target date for "${p.name}" is overdue. Please raise a delay communication to the client within 24 hours.`,
            referenceUrl: `/projects/${projectId}/delays`
          });
        }
      }
    }
  }

  /**
   * Checks for draft delay notifications older than 24 hours and escalates them.
   */
  async checkAndEscalateDelays(tenantId) {
    // Find drafts older than 24 hours that haven't been escalated yet.
    // We can use a simple check: created_at < NOW() - INTERVAL '24 hours'.
    // To prevent spam, we need to know if we already escalated. We can add a simple 'escalated_at' column 
    // or just rely on a separate query or assume we send one alert daily for ongoing old ones.
    // To be safe, we'll notify PM and Ops Head if it's over 24h. We'll add a 'status' like 'escalated' maybe?
    // Wait, the migration doesn't have an escalated state. Let's just do a naive check for drafts 
    // created between 24 and 48 hours ago to send exactly one escalation, or just add a flag in a new migration, 
    // or use a simple time window.
    
    const query = `
      SELECT dn.id, dn.project_id, dn.tenant_id, dn.type, p.name as project_name, p.pm_id
      FROM delay_notifications dn
      JOIN projects p ON dn.project_id = p.id
      WHERE dn.status = 'draft' 
        AND dn.created_at < NOW() - INTERVAL '24 hours'
        AND dn.created_at >= NOW() - INTERVAL '48 hours'
        AND dn.tenant_id = $1
    `;
    const overdueDrafts = await pool.query(query, [tenantId]);

    if (overdueDrafts.rows.length === 0) return;

    // Fetch ops head (assuming we can find a user with role 'ops_head' or similar, 
    // or we just send it to a generic Ops team list, or the tenant admin)
    const opsQuery = `SELECT id FROM users WHERE tenant_id = $1 AND role IN ('ops_head', 'admin') LIMIT 1`;
    const opsRes = await pool.query(opsQuery, [tenantId]);
    const opsHeadId = opsRes.rows[0]?.id;

    for (const draft of overdueDrafts.rows) {
      const pmId = draft.pm_id;
      const msg = `ESCALATION: Delay communication for project "${draft.project_name}" has been pending for over 24 hours without client notification.`;
      
      if (pmId) {
        notifyUser({
          tenantId,
          userId: pmId,
          type: 'DELAY_ESCALATED',
          message: msg,
          referenceUrl: `/projects/${draft.project_id}/delays`
        });
      }

      if (opsHeadId) {
        notifyUser({
          tenantId,
          userId: opsHeadId,
          type: 'DELAY_ESCALATED',
          message: msg,
          referenceUrl: `/projects/${draft.project_id}/delays`
        });
      }
      
      console.log(`[DelayEscalation] Escalated delay draft ${draft.id} for project ${draft.project_id}`);
    }
  }
}

module.exports = new DelayNotificationService();
