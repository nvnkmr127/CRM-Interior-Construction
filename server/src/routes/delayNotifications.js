const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../db/pool');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');

router.use(authenticate);

// Auto-detect overdue milestones or project target dates and create draft delay notifications
const detectAndCreateDelayDrafts = async (tenantId, projectId) => {
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
      `;
      await pool.query(insertQuery, [
        tenantId, projectId, m.id, m.due_date, revisedDateStr, draftText
      ]);
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
    }
  }
};

// GET /api/projects/:projectId/delay-notifications
router.get('/', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;

    // Run auto-detection
    await detectAndCreateDelayDrafts(tenantId, projectId);

    const query = `
      SELECT dn.*, m.name as milestone_name
      FROM delay_notifications dn
      LEFT JOIN milestones m ON dn.milestone_id = m.id
      WHERE dn.project_id = $1 AND dn.tenant_id = $2
      ORDER BY dn.created_at DESC
    `;
    const result = await pool.query(query, [projectId, tenantId]);
    return success(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/projects/:projectId/delay-notifications/:id
router.patch('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { projectId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;
    const { revised_date, reason, message_draft } = req.body;

    const query = `
      UPDATE delay_notifications
      SET revised_date = COALESCE($1, revised_date),
          reason = COALESCE($2, reason),
          message_draft = COALESCE($3, message_draft),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND project_id = $5 AND tenant_id = $6
      RETURNING *
    `;
    const result = await pool.query(query, [revised_date, reason, message_draft, id, projectId, tenantId]);

    if (result.rows.length === 0) return fail(res, 'NOT_FOUND', 'Delay notification not found', 404);
    return success(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// POST /api/projects/:projectId/delay-notifications/:id/send
router.post('/:id/send', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { projectId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;

    const query = `
      UPDATE delay_notifications
      SET status = 'sent',
          sent_at = CURRENT_TIMESTAMP,
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $1 AND project_id = $2 AND tenant_id = $3
      RETURNING *
    `;
    const result = await pool.query(query, [id, projectId, tenantId]);

    if (result.rows.length === 0) return fail(res, 'NOT_FOUND', 'Delay notification not found', 404);
    const notification = result.rows[0];

    // Log in communications timeline
    const commQuery = `
      INSERT INTO communications (tenant_id, user_id, channel, direction, status, subject, body, metadata)
      VALUES ($1, $2, 'email', 'outbound', 'sent', $3, $4, $5)
    `;
    await pool.query(commQuery, [
      tenantId,
      req.user.userId || req.user.id,
      `Project Timeline Delay Update`,
      notification.message_draft,
      JSON.stringify({ delay_notification_id: id })
    ]);

    return success(res, notification);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/projects/:projectId/delay-notifications/:id
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const { projectId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;

    const query = `
      DELETE FROM delay_notifications
      WHERE id = $1 AND project_id = $2 AND tenant_id = $3
    `;
    const result = await pool.query(query, [id, projectId, tenantId]);

    if (result.rowCount === 0) return fail(res, 'NOT_FOUND', 'Delay notification not found', 404);
    return success(res, { message: 'Delay notification draft deleted' });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
