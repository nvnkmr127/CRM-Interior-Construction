const crypto = require('crypto');
const pool = require('../../db/pool');
const { verifyPassword } = require('./password');
const { signAccessToken, signRefreshToken } = require('./tokens');

/**
 * Authenticates a user and creates a session.
 * @param {Object} params - { email, password, tenantId, ip, userAgent }
 * @returns {Promise<Object>} { accessToken, refreshToken, user }
 */
async function loginUser({ email, password, tenantId, ip, userAgent }) {
  // 1. Find user by tenant_id + email
  const userResult = await pool.query(
    'SELECT * FROM users WHERE tenant_id = $1 AND email = $2 LIMIT 1',
    [tenantId, email]
  );

  if (userResult.rows.length === 0) {
    throw new Error('INVALID_CREDENTIALS');
  }

  const user = userResult.rows[0];

  // 2. Check user status
  if (user.status !== 'active') {
    throw new Error('ACCOUNT_INACTIVE');
  }

  // 3. Verify password
  const isPasswordValid = await verifyPassword(password, user.password_hash);
  if (!isPasswordValid) {
    throw new Error('INVALID_CREDENTIALS');
  }

  // 4. Fetch role name and permissions for the JWT payload
  let roleName = null;
  let rolePermissions = [];
  if (user.role_id) {
    const roleResult = await pool.query(
      'SELECT name, permissions FROM roles WHERE id = $1',
      [user.role_id]
    );
    if (roleResult.rows.length > 0) {
      roleName = roleResult.rows[0].name;
      rolePermissions = roleResult.rows[0].permissions || [];
    }
  }

  const payload = {
    userId: user.id,
    tenantId,
    role: roleName,
    permissions: rolePermissions,
    email: user.email
  };
  
  const accessToken = signAccessToken(payload);
  const refreshToken = signRefreshToken(payload);

  // 5. Hash the refresh token and insert into sessions table
  const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
  
  const insertSessionQuery = `
    INSERT INTO sessions (user_id, tenant_id, token_hash, expires_at, ip_address, user_agent)
    VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', $4, $5)
  `;

  await pool.query(insertSessionQuery, [
    user.id,
    tenantId,
    tokenHash,
    ip,
    userAgent
  ]);

  // 6. Return response (excluding password_hash)
  delete user.password_hash;

  return {
    accessToken,
    refreshToken,
    user
  };
}

module.exports = {
  loginUser,
};
