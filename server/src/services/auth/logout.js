const crypto = require('crypto');
const pool = require('../../db/pool');
const { logAction } = require('../auditLog');

/**
 * Logs out a user by invalidating their refresh token session.
 * @param {string} rawRefreshToken 
 * @returns {Promise<void>}
 */
async function logoutUser(rawRefreshToken) {
  if (!rawRefreshToken) return;

  // 1. Hash rawRefreshToken with SHA-256
  const tokenHash = crypto.createHash('sha256').update(rawRefreshToken).digest('hex');

  // 2. We need the session id BEFORE deleting to update login_history
  const sessionResult = await pool.query('SELECT id, user_id, tenant_id FROM sessions WHERE token_hash = $1', [tokenHash]);
  
  if (sessionResult.rows.length > 0) {
    const { id: sessionId, user_id, tenant_id } = sessionResult.rows[0];
    
    // Update login history FIRST, before ON DELETE SET NULL removes the reference
    await pool.query(`
      UPDATE login_history 
      SET logout_time = NOW(), 
          duration_seconds = EXTRACT(EPOCH FROM (NOW() - login_time))
      WHERE session_id = $1
    `, [sessionId]).catch(err => console.warn('Failed to update login history on logout', err));
    
    // Now delete the session
    await pool.query('DELETE FROM sessions WHERE id = $1', [sessionId]);

    const { clearCache } = require('../../utils/cache');
    await clearCache(`session:${sessionId}`).catch(err => console.warn('Failed to clear session cache', err));
    await logAction({ tenantId: tenant_id, userId: user_id, action: 'user.logout', entity: 'user', entityId: user_id });
  }
}

module.exports = {
  logoutUser,
};
