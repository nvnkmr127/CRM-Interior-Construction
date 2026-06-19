const pool = require('../../db/pool');

const VALID_TYPES = ['call', 'note', 'email', 'whatsapp', 'site_visit', 'meeting'];

async function logActivity({ tenantId, userId, leadId, type, title, notes, outcome, scheduledAt, ai_summary, metadata }) {
  if (!VALID_TYPES.includes(type)) {
    throw new Error(`INVALID_ACTIVITY_TYPE: Type must be one of ${VALID_TYPES.join(', ')}`);
  }

  // MOCK AI Summarization for Site Visits if notes are provided but no summary yet
  let finalAiSummary = ai_summary;
  if (type === 'site_visit' && !finalAiSummary && notes) {
    // Generate mock AI summary based on notes
    finalAiSummary = `[AI Generated] Key takeaway from site visit: ${notes.substring(0, 50)}... The client is highly engaged.`;
  }

  const query = `
    INSERT INTO activities (
      tenant_id, lead_id, user_id, type, title, notes, outcome, scheduled_at, completed_at
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, NOW()
    ) RETURNING *
  `;
  
  const values = [
    tenantId,
    leadId,
    userId,
    type,
    title || null,
    notes || null,
    outcome || null,
    scheduledAt || null
  ];

  const result = await pool.query(query, values);
  const activity = result.rows[0];

  // Insert into event timeline
  try {
    const summaryText = `Logged a ${type}: ${title || notes?.substring(0, 50) || 'No details provided'}`;
    await pool.query(`
      INSERT INTO lead_timeline (tenant_id, lead_id, event_type, entity, entity_id, summary, user_id)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [tenantId, leadId, 'activity.logged', 'activities', activity.id, summaryText, userId]);
  } catch (err) {
    console.error('[activityService] Failed to insert into lead_timeline', err);
  }

  return activity;
}

async function listActivities({ tenantId, leadId, type, page = 1, limit = 20 }) {
  let query = `
    SELECT a.*,
           u.name AS user_name,
           u.avatar_url AS user_avatar
    FROM activities a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.tenant_id = $1 AND a.lead_id = $2
  `;
  
  const values = [tenantId, leadId];
  let paramIndex = 3;

  if (type) {
    query += ` AND a.type = $${paramIndex++}`;
    values.push(type);
  }

  // Count total for pagination
  const countQuery = `SELECT COUNT(*) FROM (${query}) AS count_q`;
  const countResult = await pool.query(countQuery, values);
  const total = parseInt(countResult.rows[0].count, 10);

  // Apply pagination and sorting
  const offset = (page - 1) * limit;
  query += ` ORDER BY a.created_at DESC LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  values.push(limit, offset);

  const result = await pool.query(query, values);

  return {
    data: result.rows,
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10)
  };
}

async function getLastActivity(tenantId, leadId) {
  const query = `
    SELECT a.*,
           u.name AS user_name,
           u.avatar_url AS user_avatar
    FROM activities a
    LEFT JOIN users u ON a.user_id = u.id
    WHERE a.tenant_id = $1 AND a.lead_id = $2
    ORDER BY a.created_at DESC
    LIMIT 1
  `;
  
  const result = await pool.query(query, [tenantId, leadId]);
  return result.rows[0] || null;
}

module.exports = {
  logActivity,
  listActivities,
  getLastActivity
};
