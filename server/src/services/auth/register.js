const pool = require('../../db/pool');
const { hashPassword, validatePasswordPolicy, recordPasswordChange } = require('./password');

/**
 * Registers a new user for a specific tenant.
 * @param {Object} params - { tenantId, email, name, password, roleId }
 * @returns {Promise<Object>} The created user (without password_hash)
 */
async function registerUser({ tenantId, email, name, password, roleId }) {
  // 1. Check if email already exists for this tenant
  const existingUserResult = await pool.query(
    'SELECT id FROM users WHERE tenant_id = $1 AND email = $2 LIMIT 1',
    [tenantId, email]
  );

  if (existingUserResult.rows.length > 0) {
    throw new Error('EMAIL_EXISTS');
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
    name,
    email,
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
