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
  await pool.query('DELETE FROM sessions WHERE token_hash = $1', [tokenHash]);
}

module.exports = {
  logoutUser,
};
