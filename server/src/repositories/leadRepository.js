const pool = require('../db/pool');

async function createLead(tenantId, data) {
  const { name, email, phone, source, stage_id, assignee_id, score, custom_fields, notes, status, created_by } = data;
  
  const query = `
    INSERT INTO leads (
      tenant_id, name, email, phone, source, stage_id, assignee_id, score, custom_fields, notes, status, created_by
    ) VALUES (
      $1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12
    ) RETURNING *
  `;
  
  const values = [
    tenantId,
    name,
    email || null,
    phone || null,
    source || null,
    stage_id || null,
    assignee_id || null,
    score || 0,
    custom_fields || '{}',
    notes || null,
    status || 'active',
    created_by || null
  ];
  
  const result = await pool.query(query, values);
  return result.rows[0];
}

async function findLeadById(tenantId, leadId) {
  const query = `
    SELECT l.*,
           u.name AS assignee_name, u.avatar_url AS assignee_avatar,
           s.name AS stage_name, s.color AS stage_color
    FROM leads l
    LEFT JOIN users u ON l.assignee_id = u.id
    LEFT JOIN lead_stages s ON l.stage_id = s.id
    WHERE l.tenant_id = $1 AND l.id = $2 AND l.deleted_at IS NULL
  `;
  
  const result = await pool.query(query, [tenantId, leadId]);
  return result.rows[0] || null;
}

async function findLeads(tenantId, { stageId, assigneeId, search, source, sortBy, sortDesc, page = 1, limit = 20 }) {
  let query = `
    SELECT l.*,
           u.name AS assignee_name, u.avatar_url AS assignee_avatar,
           s.name AS stage_name, s.color AS stage_color
    FROM leads l
    LEFT JOIN users u ON l.assignee_id = u.id
    LEFT JOIN lead_stages s ON l.stage_id = s.id
    WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
  `;
  
  const values = [tenantId];
  let paramIndex = 2;
  
  if (stageId) {
    query += ` AND l.stage_id = $${paramIndex++}`;
    values.push(stageId);
  }
  
  if (assigneeId) {
    query += ` AND l.assignee_id = $${paramIndex++}`;
    values.push(assigneeId);
  }
  
  if (source) {
    query += ` AND l.source = $${paramIndex++}`;
    values.push(source);
  }
  
  if (search) {
    query += ` AND (l.name ILIKE $${paramIndex} OR l.email ILIKE $${paramIndex} OR l.phone ILIKE $${paramIndex})`;
    values.push(`%${search}%`);
    paramIndex++;
  }
  
  // Count total for pagination
  const countQuery = `SELECT COUNT(*) FROM (${query}) AS count_q`;
  const countResult = await pool.query(countQuery, values);
  const total = parseInt(countResult.rows[0].count, 10);
  
  // Apply ordering
  let orderField = 'l.created_at';
  if (sortBy === 'score') orderField = 'l.score';
  else if (sortBy === 'name') orderField = 'l.name';
  
  const orderDirection = sortDesc === 'false' || sortDesc === false ? 'ASC' : 'DESC';

  const offset = (page - 1) * limit;
  query += ` ORDER BY ${orderField} ${orderDirection} LIMIT $${paramIndex++} OFFSET $${paramIndex}`;
  values.push(limit, offset);
  
  const result = await pool.query(query, values);
  
  return {
    data: result.rows,
    total,
    page: parseInt(page, 10),
    limit: parseInt(limit, 10)
  };
}

async function updateLead(tenantId, leadId, updates) {
  const fields = [];
  const values = [];
  let paramIndex = 1;
  
  for (const [key, value] of Object.entries(updates)) {
    if (key === 'id' || key === 'tenant_id' || key === 'created_at' || key === 'updated_at' || key === 'deleted_at') {
      continue;
    }
    fields.push(`${key} = $${paramIndex++}`);
    values.push(value);
  }
  
  if (fields.length === 0) {
    return findLeadById(tenantId, leadId);
  }
  
  fields.push(`updated_at = NOW()`);
  
  const query = `
    UPDATE leads
    SET ${fields.join(', ')}
    WHERE tenant_id = $${paramIndex++} AND id = $${paramIndex} AND deleted_at IS NULL
    RETURNING *
  `;
  
  values.push(tenantId, leadId);
  
  const result = await pool.query(query, values);
  return result.rows[0] || null;
}

async function softDeleteLead(tenantId, leadId) {
  const query = `
    UPDATE leads
    SET deleted_at = NOW()
    WHERE tenant_id = $1 AND id = $2 AND deleted_at IS NULL
  `;
  await pool.query(query, [tenantId, leadId]);
}

async function convertLeadToProject(tenantId, leadId, projectId) {
  const query = `
    UPDATE leads
    SET converted_to_project_id = $1, status = 'converted', updated_at = NOW()
    WHERE tenant_id = $2 AND id = $3 AND deleted_at IS NULL
  `;
  await pool.query(query, [projectId, tenantId, leadId]);
}

async function getLeadStats(tenantId) {
  const query = `
    SELECT
      COUNT(*) AS total_leads,
      COUNT(*) FILTER (
        WHERE s.is_won = true 
        AND (l.updated_at >= date_trunc('month', CURRENT_DATE) OR l.created_at >= date_trunc('month', CURRENT_DATE))
      ) AS won_this_month,
      COUNT(*) FILTER (WHERE s.is_won = true) AS total_won,
      AVG(NULLIF(l.score, 0)) AS avg_score
    FROM leads l
    LEFT JOIN lead_stages s ON l.stage_id = s.id
    WHERE l.tenant_id = $1 AND l.deleted_at IS NULL
  `;
  const result = await pool.query(query, [tenantId]);
  const row = result.rows[0];
  
  const totalLeads = parseInt(row.total_leads, 10) || 0;
  const totalWon = parseInt(row.total_won, 10) || 0;
  const avgScore = Math.round(parseFloat(row.avg_score)) || 0;
  const convPct = totalLeads > 0 ? Math.round((totalWon / totalLeads) * 100) : 0;

  return {
    total: totalLeads,
    wonThisMonth: parseInt(row.won_this_month, 10) || 0,
    avgScore,
    convPct
  };
}

module.exports = {
  createLead,
  findLeadById,
  findLeads,
  updateLead,
  softDeleteLead,
  convertLeadToProject,
  getLeadStats
};
