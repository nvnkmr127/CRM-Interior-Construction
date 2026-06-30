const express = require('express');
const router = express.Router({ mergeParams: true });
const pool = require('../db/pool');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');

router.use(authenticate);

const delayNotificationService = require('../services/projects/delayNotificationService');

// GET /api/projects/:projectId/delay-notifications
router.get('/', async (req, res, next) => {
  try {
    const { projectId } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;

    // Run auto-detection
    await delayNotificationService.detectAndCreateDelayDrafts(tenantId, projectId);

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
