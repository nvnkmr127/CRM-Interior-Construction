const express = require('express');
const pool = require('../db/pool');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');

const router = express.Router();

/**
 * GET /api/auth/sessions
 * Returns all active sessions for the current user
 */
router.get('/', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const tenantId = req.tenantId;

    const result = await pool.query(
      `SELECT id, created_at, expires_at, ip_address, user_agent 
       FROM sessions 
       WHERE user_id = $1 AND tenant_id = $2
       ORDER BY created_at DESC`,
      [userId, tenantId]
    );

    return success(res, { sessions: result.rows });
  } catch (err) {
    next(err);
  }
});

/**
 * DELETE /api/auth/sessions/:sessionId
 * Revokes a specific session by ID
 */
router.delete('/:sessionId', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const tenantId = req.tenantId;
    const sessionId = req.params.sessionId;

    // First, verify session exists
    const checkResult = await pool.query(
      `SELECT id FROM sessions WHERE id = $1 AND user_id = $2 AND tenant_id = $3`,
      [sessionId, userId, tenantId]
    );

    if (checkResult.rowCount === 0) {
      return res.status(404).json(fail('Session not found or unauthorized'));
    }

    // Update login history FIRST
    await pool.query(`
      UPDATE login_history 
      SET logout_time = NOW(), 
          duration_seconds = EXTRACT(EPOCH FROM (NOW() - login_time))
      WHERE session_id = $1
    `, [sessionId]).catch(err => console.warn('Failed to update login history on revoke', err));

    // Then delete session
    await pool.query(`DELETE FROM sessions WHERE id = $1`, [sessionId]);

    return success(res, { message: 'Session revoked successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
