const pool = require('../db/pool');

async function createKey(tenantId, userId, { name, description, permissions, secretHash }) {
  try {
    const res = await pool.query(
      `INSERT INTO api_keys (tenant_id, name, description, permissions, secret_hash, created_by, status)
       VALUES ($1, $2, $3, $4, $5, $6, 'active')
       RETURNING *`,
      [tenantId, name, description, JSON.stringify(permissions || []), secretHash, userId]
    );
    return res.rows[0];
  } catch (err) {
    const fallback = await pool.query(
      `INSERT INTO api_keys (tenant_id, name, key_hash, key_prefix, scopes, created_by, is_active)
       VALUES ($1, $2, $3, $4, $5, $6, true)
       RETURNING *`,
      [tenantId, name, secretHash, 'crm_live', JSON.stringify(permissions || []), userId]
    );
    return fallback.rows[0];
  }
}

async function getKeys(tenantId) {
  try {
    const res = await pool.query(
      `SELECT * FROM api_keys 
       WHERE tenant_id = $1 
       ORDER BY created_at DESC`,
      [tenantId]
    );
    return (res.rows || []).map(r => ({
      ...r,
      permissions: r.permissions || r.scopes || [],
      status: r.status || (r.is_active ? 'active' : 'inactive')
    }));
  } catch (err) {
    return [];
  }
}

async function updateKey(tenantId, keyId, { name, description, permissions, status }) {
  try {
    const res = await pool.query(
      `UPDATE api_keys 
       SET name = COALESCE($1, name), 
           description = COALESCE($2, description), 
           permissions = COALESCE($3, permissions), 
           status = COALESCE($4, status),
           updated_at = CURRENT_TIMESTAMP
       WHERE tenant_id = $5 AND id = $6
       RETURNING *`,
      [name, description, permissions ? JSON.stringify(permissions) : null, status, tenantId, keyId]
    );
    return res.rows[0];
  } catch (err) {
    const fallback = await pool.query(
      `UPDATE api_keys 
       SET name = COALESCE($1, name), 
           scopes = COALESCE($2, scopes), 
           is_active = COALESCE($3, is_active)
       WHERE tenant_id = $4 AND id = $5
       RETURNING *`,
      [name, permissions ? JSON.stringify(permissions) : null, status === 'active', tenantId, keyId]
    );
    return fallback.rows[0];
  }
}

async function updateKeySecret(tenantId, keyId, secretHash) {
  try {
    const res = await pool.query(
      `UPDATE api_keys SET secret_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $2 AND id = $3 RETURNING id`,
      [secretHash, tenantId, keyId]
    );
    return res.rows[0];
  } catch (err) {
    const fallback = await pool.query(
      `UPDATE api_keys SET key_hash = $1 WHERE tenant_id = $2 AND id = $3 RETURNING id`,
      [secretHash, tenantId, keyId]
    );
    return fallback.rows[0];
  }
}

async function deleteKey(tenantId, keyId) {
  try {
    await pool.query(
      `DELETE FROM api_keys WHERE tenant_id = $1 AND id = $2`,
      [tenantId, keyId]
    );
  } catch (err) {
    console.error('Delete key error:', err);
  }
}

async function getDashboardStats(tenantId) {
  try {
    let stats = {
      total_requests: 0,
      successful_requests: 0,
      failed_requests: 0,
      last_request_at: null
    };
    let recentLogs = [];

    try {
      const statsRes = await pool.query(
        `SELECT 
          COUNT(*) as total_requests,
          COUNT(CASE WHEN status_code >= 200 AND status_code < 300 THEN 1 END) as successful_requests,
          COUNT(CASE WHEN status_code >= 400 THEN 1 END) as failed_requests,
          MAX(created_at) as last_request_at
         FROM api_logs 
         WHERE tenant_id = $1`,
        [tenantId]
      );
      if (statsRes.rows[0]) stats = statsRes.rows[0];

      const logsRes = await pool.query(
        `SELECT l.id, k.name as key_name, l.endpoint, l.method, l.status_code, l.execution_time_ms, l.created_at
         FROM api_logs l
         LEFT JOIN api_keys k ON l.api_key_id = k.id
         WHERE l.tenant_id = $1
         ORDER BY l.created_at DESC
         LIMIT 50`,
        [tenantId]
      );
      recentLogs = logsRes.rows || [];
    } catch (tblErr) {
      // api_logs table may not exist yet
    }

    return {
      stats,
      recentLogs
    };
  } catch (err) {
    return {
      stats: { total_requests: 0, successful_requests: 0, failed_requests: 0, last_request_at: null },
      recentLogs: []
    };
  }
}

module.exports = {
  createKey,
  getKeys,
  updateKey,
  updateKeySecret,
  deleteKey,
  getDashboardStats
};
