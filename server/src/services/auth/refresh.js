const crypto = require('crypto');
const pool = require('../../db/pool');
const { verifyRefreshToken, signAccessToken, signRefreshToken } = require('./tokens');

/**
 * Rotates a refresh token.
 * @param {string} rawRefreshToken 
 * @returns {Promise<Object>} { accessToken, refreshToken }
 */
async function refreshTokens(rawRefreshToken) {
  let decoded;
  try {
    // 1. Verify the token
    decoded = verifyRefreshToken(rawRefreshToken);
  } catch (err) {
    throw new Error('TOKEN_INVALID');
  }

  // 2. Hash the raw token and look up in sessions
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');
  
  const sessionResult = await pool.query(
    'SELECT * FROM sessions WHERE token_hash = $1 LIMIT 1',
    [tokenHash]
  );

  if (sessionResult.rows.length === 0) {
    throw new Error('SESSION_NOT_FOUND');
  }

  const session = sessionResult.rows[0];

  // 3. Check if session is expired
  if (new Date(session.expires_at) < new Date()) {
    throw new Error('SESSION_EXPIRED');
  }

  // 4. Delete the old session (token rotation - one-time use)
  await pool.query('DELETE FROM sessions WHERE id = $1', [session.id]);

  // 5. Sign new access + refresh tokens
  const payload = {
    userId: decoded.userId,
    tenantId: decoded.tenantId,
    role: decoded.role,
    email: decoded.email
  };

  const newAccessToken = signAccessToken(payload);
  const newRefreshToken = signRefreshToken(payload);

  // 6. Insert new session into DB
  const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
  
  const insertSessionQuery = `
    INSERT INTO sessions (user_id, tenant_id, token_hash, expires_at, ip_address, user_agent)
    VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', $4, $5)
  `;

  await pool.query(insertSessionQuery, [
    session.user_id,
    session.tenant_id,
    newTokenHash,
    session.ip_address, // Carrying over IP from old session
    session.user_agent  // Carrying over User Agent from old session
  ]);

  // 7. Return new tokens
  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken
  };
}

module.exports = {
  refreshTokens,
};
