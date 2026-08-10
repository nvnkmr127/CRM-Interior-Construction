const pool = require('../../db/pool');
const eventBus = require('../../utils/eventBus');

exports.logActivity = async (data) => {
  const { tenantId, leadId, userId, type, title, notes, scheduledAt, outcome, metadata } = data;
  const { rows } = await pool.query(
    `INSERT INTO activities (tenant_id, lead_id, user_id, type, title, notes, scheduled_at, outcome, metadata)
     VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9) RETURNING *`,
    [tenantId, leadId, userId, type, title, notes, scheduledAt || null, outcome, metadata || {}]
  );
  const activity = rows[0];
  
  eventBus.emit('activity.created', {
    eventName: 'activity.created',
    payload: activity,
    context: { tenantId, userId }
  });

  return activity;
};

exports.listActivities = async ({ tenantId, leadId, limit = 50 }) => {
  const { rows } = await pool.query(
    `SELECT * FROM activities WHERE tenant_id = $1 AND lead_id = $2 ORDER BY created_at DESC LIMIT $3`,
    [tenantId, leadId, limit]
  );
  return { data: rows };
};

exports.updateActivity = async (tenantId, activityId, data) => {
  const { title, notes, scheduledAt, outcome, metadata } = data;
  const { rows } = await pool.query(
    `UPDATE activities 
     SET title = COALESCE($1, title), 
         notes = COALESCE($2, notes), 
         scheduled_at = COALESCE($3, scheduled_at),
         outcome = COALESCE($4, outcome),
         metadata = COALESCE($5, metadata),
         updated_at = NOW()
     WHERE id = $6 AND tenant_id = $7 RETURNING *`,
    [title, notes, scheduledAt || null, outcome, metadata || {}, activityId, tenantId]
  );
  return rows[0];
};
