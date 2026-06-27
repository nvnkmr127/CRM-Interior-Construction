const pool = require('../db/pool');

async function getTenantThreshold(tenantId, key, defaultValue) {
  try {
    const { rows } = await pool.query('SELECT config FROM tenants WHERE id = $1', [tenantId]);
    if (rows.length === 0) return defaultValue;
    const configStr = rows[0].config;
    const config = typeof configStr === 'string' ? JSON.parse(configStr || '{}') : (configStr || {});
    return config[key] !== undefined && config[key] !== '' ? Number(config[key]) : defaultValue;
  } catch (error) {
    console.error(`Error reading threshold ${key} for tenant ${tenantId}:`, error);
    return defaultValue;
  }
}

async function isUserSuperadmin(userId) {
  if (!userId) return false;
  try {
    const { rows } = await pool.query(
      `SELECT r.name as role_name 
       FROM users u 
       JOIN roles r ON u.role_id = r.id 
       WHERE u.id = $1`,
      [userId]
    );
    return rows.length > 0 && rows[0].role_name === 'superadmin';
  } catch (error) {
    console.error(`Error checking if user ${userId} is superadmin:`, error);
    return false;
  }
}

module.exports = {
  getTenantThreshold,
  isUserSuperadmin
};
