const pool = require('../db/pool');

async function createKey(tenantId, userId, { name, description, permissions, secretHash }) {
  const res = await pool.query(
    `INSERT INTO api_keys (tenant_id, name, description, permissions, secret_hash, created_by, status)
     VALUES ($1, $2, $3, $4, $5, $6, 'active')
     RETURNING id, name, description, permissions, status, created_at`,
    [tenantId, name, description, JSON.stringify(permissions || []), secretHash, userId]
  );
  return res.rows[0];
}

async function getKeys(tenantId) {
  const res = await pool.query(
    `SELECT id, name, description, permissions, status, last_used_at, created_at 
     FROM api_keys 
     WHERE tenant_id = $1 
     ORDER BY created_at DESC`,
    [tenantId]
  );
  return res.rows;
}

async function updateKey(tenantId, keyId, { name, description, permissions, status }) {
  const res = await pool.query(
    `UPDATE api_keys 
     SET name = COALESCE($1, name), 
         description = COALESCE($2, description), 
         permissions = COALESCE($3, permissions), 
         status = COALESCE($4, status),
         updated_at = CURRENT_TIMESTAMP
     WHERE tenant_id = $5 AND id = $6
     RETURNING id, name, description, permissions, status, created_at`,
    [name, description, permissions ? JSON.stringify(permissions) : null, status, tenantId, keyId]
  );
  return res.rows[0];
}

async function updateKeySecret(tenantId, keyId, secretHash) {
  const res = await pool.query(
    `UPDATE api_keys SET secret_hash = $1, updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $2 AND id = $3 RETURNING id`,
    [secretHash, tenantId, keyId]
  );
  return res.rows[0];
}

async function deleteKey(tenantId, keyId) {
  await pool.query(
    `DELETE FROM api_keys WHERE tenant_id = $1 AND id = $2`,
    [tenantId, keyId]
  );
}

async function getDashboardStats(tenantId) {
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

  const logsRes = await pool.query(
    `SELECT l.id, k.name as key_name, l.endpoint, l.method, l.status_code, l.execution_time_ms, l.created_at
     FROM api_logs l
     LEFT JOIN api_keys k ON l.api_key_id = k.id
     WHERE l.tenant_id = $1
     ORDER BY l.created_at DESC
     LIMIT 50`,
    [tenantId]
  );

  return {
    stats: statsRes.rows[0],
    recentLogs: logsRes.rows
  };
}

module.exports = {
  createKey,
  getKeys,
  updateKey,
  updateKeySecret,
  deleteKey,
  getDashboardStats
};
