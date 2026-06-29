const pool = require('../../config/db');
const { logAction } = require('../auditLog');

/**
 * Automatically generates the 4 post-handover retention follow-up schedules (30, 90, 180, 365 days).
 */
async function generateRetentionSchedules(tenantId, projectId, handoverDateStr, client = pool) {
  const handoverDate = new Date(handoverDateStr);
  if (isNaN(handoverDate.getTime())) {
    throw new Error('Invalid handover date');
  }

  // Stages and offset days
  const retentionStages = [
    { stage: '30_day', days: 30 },
    { stage: '90_day', days: 90 },
    { stage: '180_day', days: 180 },
    { stage: '365_day', days: 365 }
  ];

  const results = [];
  for (const item of retentionStages) {
    const scheduledDate = new Date(handoverDate);
    scheduledDate.setDate(handoverDate.getDate() + item.days);

    const res = await client.query(
      `INSERT INTO customer_retention_schedules (tenant_id, project_id, stage, scheduled_date, status)
       VALUES ($1, $2, $3, $4, 'scheduled')
       ON CONFLICT (project_id, stage) DO UPDATE 
       SET scheduled_date = EXCLUDED.scheduled_date, 
           status = CASE WHEN customer_retention_schedules.status = 'scheduled' THEN 'scheduled' ELSE customer_retention_schedules.status END,
           updated_at = CURRENT_TIMESTAMP
       RETURNING *`,
      [tenantId, projectId, item.stage, scheduledDate]
    );
    results.push(res.rows[0]);
  }

  return results;
}

/**
 * Fetches all retention follow-up schedules for a project.
 */
async function getRetentionSchedules(projectId, tenantId) {
  const res = await pool.query(
    `SELECT crs.id, crs.project_id, crs.stage, crs.scheduled_date::TEXT as scheduled_date, crs.status,
            crs.actual_date::TEXT as actual_date, crs.feedback, crs.csat_score, crs.notes, crs.created_at,
            crs.updated_at
     FROM customer_retention_schedules crs
     WHERE crs.project_id = $1 AND crs.tenant_id = $2
     ORDER BY crs.scheduled_date ASC`,
    [projectId, tenantId]
  );
  return res.rows;
}

/**
 * Updates a specific customer retention schedule (logging outcome / feedback / CSAT).
 */
async function updateRetentionSchedule(scheduleId, tenantId, updateData, userId = null) {
  // 1. Fetch existing
  const existingRes = await pool.query(
    'SELECT * FROM customer_retention_schedules WHERE id = $1 AND tenant_id = $2',
    [scheduleId, tenantId]
  );
  if (existingRes.rows.length === 0) {
    throw new Error('SCHEDULE_NOT_FOUND');
  }
  const oldValue = existingRes.rows[0];

  const status = updateData.status || oldValue.status;
  const actualDate = updateData.actualDate !== undefined ? (updateData.actualDate ? new Date(updateData.actualDate) : null) : oldValue.actual_date;
  const feedback = updateData.feedback !== undefined ? updateData.feedback : oldValue.feedback;
  const csatScore = updateData.csatScore !== undefined ? updateData.csatScore : oldValue.csat_score;
  const notes = updateData.notes !== undefined ? updateData.notes : oldValue.notes;

  // 2. Perform Update
  const updateRes = await pool.query(
    `UPDATE customer_retention_schedules
     SET status = $1,
         actual_date = $2,
         feedback = $3,
         csat_score = $4,
         notes = $5,
         created_by = COALESCE($6, created_by),
         updated_at = CURRENT_TIMESTAMP
     WHERE id = $7 AND tenant_id = $8
     RETURNING *`,
    [status, actualDate, feedback, csatScore, notes, userId, scheduleId, tenantId]
  );
  const newValue = updateRes.rows[0];

  // 3. Log Audit Action
  await logAction({
    tenantId,
    userId,
    action: 'project.retention_updated',
    entity: 'project',
    entityId: oldValue.project_id,
    oldValue,
    newValue
  });

  return newValue;
}

/**
 * Unified dashboard displaying retention follow-up details across projects.
 */
async function getRetentionDashboard(tenantId) {
  const res = await pool.query(
    `SELECT crs.id, crs.project_id, crs.stage, crs.scheduled_date::TEXT as scheduled_date, crs.status,
            crs.actual_date::TEXT as actual_date, crs.feedback, crs.csat_score, crs.notes, crs.created_at,
            p.name as project_name,
            u.name as pm_name
     FROM customer_retention_schedules crs
     JOIN projects p ON crs.project_id = p.id
     LEFT JOIN users u ON p.pm_id = u.id
     WHERE crs.tenant_id = $1 AND p.deleted_at IS NULL
     ORDER BY crs.scheduled_date ASC`,
    [tenantId]
  );
  return res.rows;
}

module.exports = {
  generateRetentionSchedules,
  getRetentionSchedules,
  updateRetentionSchedule,
  getRetentionDashboard
};
