const express = require('express');
const pool = require('../db/pool');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');

const router = express.Router();

router.use(authenticate);

function checkAdminAccess(req, res, next) {
  if (req.user.role === 'superadmin') return next();
  if (req.user.permissions && req.user.permissions.includes('audit:read')) return next();
  return fail(res, 'FORBIDDEN', 'Access requires superadmin or audit:read permissions', 403);
}

// GET /api/login-history
router.get('/', checkAdminAccess, async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    const { page = 1, limit = 50, search, status } = req.query;
    const offset = (Number(page) - 1) * Number(limit);
    
    let queryParams = [tenantId];
    let queryConditions = ['lh.tenant_id = $1'];
    
    if (status) {
      queryParams.push(status);
      queryConditions.push(`lh.status = $${queryParams.length}`);
    }

    if (search) {
      queryParams.push(`%${search}%`);
      queryConditions.push(`(
        lh.email_attempted ILIKE $${queryParams.length} OR
        lh.ip_address ILIKE $${queryParams.length} OR
        lh.browser ILIKE $${queryParams.length} OR
        lh.device ILIKE $${queryParams.length} OR
        lh.os ILIKE $${queryParams.length} OR
        u.name ILIKE $${queryParams.length} OR
        u.email ILIKE $${queryParams.length}
      )`);
    }

    const whereClause = queryConditions.length > 0 ? `WHERE ${queryConditions.join(' AND ')}` : '';

    const countQuery = `
      SELECT COUNT(*) FROM login_history lh
      LEFT JOIN users u ON lh.user_id = u.id
      ${whereClause}
    `;
    const dataQuery = `
      SELECT lh.*, u.name as user_name, u.email as user_email, s.id as active_session_id
      FROM login_history lh
      LEFT JOIN users u ON lh.user_id = u.id
      LEFT JOIN sessions s ON lh.session_id = s.id
      ${whereClause}
      ORDER BY lh.login_time DESC
      LIMIT $${queryParams.length + 1} OFFSET $${queryParams.length + 2}
    `;

    const countResult = await pool.query(countQuery, queryParams);
    const total = parseInt(countResult.rows[0].count, 10);
    
    const dataParams = [...queryParams, Number(limit), offset];
    const dataResult = await pool.query(dataQuery, dataParams);
    
    return success(res, {
      data: dataResult.rows,
      meta: {
        total,
        page: Number(page),
        limit: Number(limit),
        totalPages: Math.ceil(total / Number(limit))
      }
    });
  } catch (error) {
    next(error);
  }
});

// GET /api/login-history/export
router.get('/export', checkAdminAccess, async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    const { search, status } = req.query;
    
    let queryParams = [tenantId];
    let queryConditions = ['lh.tenant_id = $1'];
    
    if (status) {
      queryParams.push(status);
      queryConditions.push(`lh.status = $${queryParams.length}`);
    }

    if (search) {
      queryParams.push(`%${search}%`);
      queryConditions.push(`(
        lh.email_attempted ILIKE $${queryParams.length} OR
        lh.ip_address ILIKE $${queryParams.length} OR
        lh.browser ILIKE $${queryParams.length} OR
        lh.device ILIKE $${queryParams.length} OR
        lh.os ILIKE $${queryParams.length} OR
        u.name ILIKE $${queryParams.length} OR
        u.email ILIKE $${queryParams.length}
      )`);
    }

    const whereClause = queryConditions.length > 0 ? `WHERE ${queryConditions.join(' AND ')}` : '';

    const dataQuery = `
      SELECT lh.*, u.name as user_name, u.email as user_email
      FROM login_history lh
      LEFT JOIN users u ON lh.user_id = u.id
      ${whereClause}
      ORDER BY lh.login_time DESC
      LIMIT 10000
    `;

    const dataResult = await pool.query(dataQuery, queryParams);
    
    const headers = ['Login Time', 'Logout Time', 'Duration (s)', 'User Name', 'Email Attempted', 'IP Address', 'Browser', 'OS', 'Device', 'Status', 'Failure Reason'];
    let csvString = headers.map(h => `"${h}"`).join(',') + '\n';
    
    for (const row of dataResult.rows) {
      const loginTime = row.login_time ? new Date(row.login_time).toISOString() : '';
      const logoutTime = row.logout_time ? new Date(row.logout_time).toISOString() : '';
      const duration = row.duration_seconds || '';
      const userName = row.user_name || '';
      const email = row.email_attempted || '';
      const ip = row.ip_address || '';
      const browser = row.browser || '';
      const os = row.os || '';
      const device = row.device || '';
      const statusStr = row.status || '';
      const failure = row.failure_reason ? row.failure_reason.replace(/"/g, '""') : '';
      
      csvString += `"${loginTime}","${logoutTime}","${duration}","${userName}","${email}","${ip}","${browser}","${os}","${device}","${statusStr}","${failure}"\n`;
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename=login-history.csv');
    return res.send(csvString);
  } catch (error) {
    next(error);
  }
});

// DELETE /api/login-history/sessions/:sessionId
// Admin revocation of any session
router.delete('/sessions/:sessionId', checkAdminAccess, async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    const sessionId = req.params.sessionId;

    const checkResult = await pool.query(
      `SELECT id, user_id FROM sessions WHERE id = $1 AND tenant_id = $2`,
      [sessionId, tenantId]
    );

    if (checkResult.rowCount === 0) {
      return fail(res, 'NOT_FOUND', 'Session not found', 404);
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

    const { clearCache } = require('../../utils/cache');
    await clearCache(`session:${sessionId}`).catch(err => console.warn('Failed to clear session cache', err));

    return success(res, { message: 'Session forcefully revoked successfully' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
