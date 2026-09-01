const pool = require('../../db/pool');
const { hashPassword, validatePasswordPolicy, recordPasswordChange } = require('./password');

/**
 * Registers a new user for a specific tenant.
 * @param {Object} params - { tenantId, email, name, password, roleId }
 * @returns {Promise<Object>} The created user (without password_hash)
 */
async function registerUser({ tenantId, email, name, password, roleId }) {
  const cleanEmail = (email || '').trim().toLowerCase();
  const cleanName = (name || '').trim();

  // 1. Check if email already exists for this tenant
  const existingUserResult = await pool.query(
    'SELECT id FROM users WHERE tenant_id = $1 AND LOWER(email) = LOWER($2) LIMIT 1',
    [tenantId, cleanEmail]
  );

  if (existingUserResult.rows.length > 0) {
    throw new Error('EMAIL_EXISTS');
  }

  // 1.2 Check user limit as per tenant configuration
  const tenantRes = await pool.query('SELECT max_users FROM tenants WHERE id = $1 LIMIT 1', [tenantId]);
  const maxUsers = tenantRes.rows[0]?.max_users || 10;

  const countRes = await pool.query('SELECT COUNT(*)::int as count FROM users WHERE tenant_id = $1', [tenantId]);
  if (countRes.rows[0].count >= maxUsers) {
    throw new Error('PLAN_LIMIT_EXCEEDED');
  }

  // 1.5 Validate Password Policy
  await validatePasswordPolicy(password, tenantId, null);

  // 2. Hash the password
  const hashedPassword = await hashPassword(password);

  // 3. INSERT into users table.
  const insertQuery = `
    INSERT INTO users (tenant_id, role_id, name, email, password_hash)
    VALUES ($1, $2, $3, $4, $5)
    RETURNING id, tenant_id, role_id, name, email, status, created_at
  `;

  const result = await pool.query(insertQuery, [
    tenantId,
    roleId,
    cleanName,
    cleanEmail,
    hashedPassword,
  ]);

  const newUser = result.rows[0];

  // Create initial user_security and password history
  await pool.query('INSERT INTO user_security (user_id) VALUES ($1)', [newUser.id]);
  await recordPasswordChange(newUser.id, hashedPassword);

  return newUser;
}

module.exports = {
  registerUser,
};
