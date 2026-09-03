const crypto = require('crypto');
const pool = require('../../db/pool');
const { verifyRefreshToken, signAccessToken, signRefreshToken } = require('./tokens');

// In-memory cache for rotated refresh tokens to handle parallel/concurrent requests during token rotation
// Maps tokenHash -> { accessToken, refreshToken, createdAt }
const tokenRotationCache = new Map();

// Periodic cleanup of rotation cache entries older than 60 seconds
setInterval(() => {
  const now = Date.now();
  for (const [hash, entry] of tokenRotationCache.entries()) {
    if (now - entry.createdAt > 60000) {
      tokenRotationCache.delete(hash);
    }
  }
}, 30000);

/**
 * Rotates a refresh token.
 * @param {string} rawRefreshToken 
 * @returns {Promise<Object>} { accessToken, refreshToken }
 */
async function refreshTokens(rawRefreshToken) {
  let decoded;
  try {
    // 1. Verify the token signature & expiration
    decoded = verifyRefreshToken(rawRefreshToken);
  } catch (error) {
    throw new Error('TOKEN_INVALID', { cause: error });
  }

  // 1.5 Check if tenant is active
  if (decoded && decoded.tenantId) {
    const tenantCheck = await pool.query('SELECT is_active FROM tenants WHERE id = $1', [decoded.tenantId]);
    if (tenantCheck.rowCount === 0 || !tenantCheck.rows[0].is_active) {
      const err = new Error('TENANT_DEACTIVATED');
      err.code = 'TENANT_DEACTIVATED';
      throw err;
    }
  }

  // 2. Hash the raw token
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  // Check Grace Period Cache (handles race conditions when multiple parallel requests hit /auth/refresh at once)
  if (tokenRotationCache.has(tokenHash)) {
    const cached = tokenRotationCache.get(tokenHash);
    if (Date.now() - cached.createdAt < 60000) {
      return {
        accessToken: cached.accessToken,
        refreshToken: cached.refreshToken
      };
    }
  }
  
  const sessionResult = await pool.query(
    'SELECT * FROM sessions WHERE token_hash = $1 LIMIT 1',
    [tokenHash]
  );

  if (sessionResult.rows.length === 0) {
    // Session not found in DB for this token hash.
    // Throw SESSION_EXPIRED so client triggers standard refresh failure / login redirect
    // without wiping all other active sessions for the user across devices.
    throw new Error('SESSION_EXPIRED');
  }

  const session = sessionResult.rows[0];

  // 3. Check if session is expired
  if (new Date(session.expires_at) < new Date()) {
    await pool.query('DELETE FROM sessions WHERE id = $1', [session.id]).catch(() => {});
    throw new Error('SESSION_EXPIRED');
  }

  // 4. Delete the old session (token rotation - one-time use)
  await pool.query('DELETE FROM sessions WHERE id = $1', [session.id]);

  // 5. Sign new access + refresh tokens
  const newSessionId = crypto.randomUUID();
  const payload = {
    userId: decoded.userId,
    tenantId: decoded.tenantId,
    role: decoded.role,
    email: decoded.email,
    sessionId: newSessionId
  };

  const newAccessToken = signAccessToken(payload);
  const newRefreshToken = signRefreshToken(payload);

  // 6. Insert new session into DB
  const newTokenHash = crypto.createHash('sha256').update(newRefreshToken).digest('hex');
  
  const insertSessionQuery = `
    INSERT INTO sessions (id, user_id, tenant_id, token_hash, expires_at, ip_address, user_agent, last_active_at)
    VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days', $5, $6, NOW())
  `;

  await pool.query(insertSessionQuery, [
    newSessionId,
    decoded.userId,
    decoded.tenantId,
    newTokenHash,
    session.ip_address || null,
    session.user_agent || null
  ]);

  // Store in grace period rotation cache
  tokenRotationCache.set(tokenHash, {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken,
    createdAt: Date.now()
  });

  // 7. Return new tokens
  return {
    accessToken: newAccessToken,
    refreshToken: newRefreshToken
  };
}

module.exports = {
  refreshTokens,
};
