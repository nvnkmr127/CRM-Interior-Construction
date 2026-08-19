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

exports.listActivities = async ({ tenantId, leadId, type, page = 1, limit = 50 }) => {
  let query = `SELECT * FROM activities WHERE tenant_id = $1 AND lead_id = $2`;
  const params = [tenantId, leadId];
  
  if (type) {
    query += ` AND type = $${params.length + 1}`;
    params.push(type);
  }
  
  // Total count for pagination
  const countQuery = `SELECT COUNT(*) as total FROM activities WHERE tenant_id = $1 AND lead_id = $2${type ? ' AND type = $3' : ''}`;
  const countRes = await pool.query(countQuery, type ? [tenantId, leadId, type] : [tenantId, leadId]);
  const total = parseInt(countRes.rows[0].total, 10);
  
  query += ` ORDER BY created_at DESC LIMIT $${params.length + 1} OFFSET $${params.length + 2}`;
  const offset = (page - 1) * limit;
  params.push(limit, offset);
  
  const { rows } = await pool.query(query, params);
  return { data: rows, total, page, limit };
};

exports.updateActivity = async (tenantId, activityId, data) => {
  const { title, notes, scheduledAt, outcome, metadata } = data;
  const { rows } = await pool.query(
    `UPDATE activities 
     SET title = COALESCE($1, title), 
         notes = COALESCE($2, notes), 
         scheduled_at = COALESCE($3, scheduled_at),
         outcome = COALESCE($4, outcome),
         metadata = COALESCE($5, metadata)
     WHERE id = $6 AND tenant_id = $7 RETURNING *`,
    [title, notes, scheduledAt || null, outcome, metadata || {}, activityId, tenantId]
  );
  
  if (rows[0]) {
    const updated = rows[0];
    await pool.query(
      `UPDATE lead_timeline
       SET summary = $1
       WHERE entity_id = $2 AND tenant_id = $3 AND entity = 'activity'`,
      [updated.notes || updated.title || '', activityId, tenantId]
    );
  }
  
  return rows[0];
};

exports.deleteActivity = async (tenantId, activityId) => {
  await pool.query(
    'DELETE FROM activities WHERE id = $1 AND tenant_id = $2',
    [activityId, tenantId]
  );
  await pool.query(
    'DELETE FROM lead_timeline WHERE entity_id = $1 AND tenant_id = $2 AND entity = $3',
    [activityId, tenantId, 'activity']
  );
  return true;
};
