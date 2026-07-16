const crypto = require('crypto');
const pool = require('../../db/pool');

/**
 * Logs out a user by invalidating their refresh token session.
 * @param {string} rawRefreshToken 
 * @returns {Promise<void>}
 */
async function logoutUser(rawRefreshToken) {
  if (!rawRefreshToken) return;

  // 1. Hash rawRefreshToken with SHA-256
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  // 2. DELETE FROM sessions WHERE token_hash = $1
  // 3. No error if session not found (idempotent logout)
  const result = await pool.query('DELETE FROM sessions WHERE token_hash = $1 RETURNING id', [tokenHash]);
  
  if (result.rows.length > 0) {
    const sessionId = result.rows[0].id;
    const { clearCache } = require('../../utils/cache');
    await clearCache(`session:${sessionId}`).catch(err => console.warn('Failed to clear session cache', err));
  }
}

module.exports = {
  logoutUser,
};
