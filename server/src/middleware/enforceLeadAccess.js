const logger = require('../utils/logger');
const pool = require('../db/pool');
const dataScope = require('./dataScope');
const authenticate = require('./authenticate');

/**
 * Middleware to enforce lead-level ownership access for direct /leads/:id routes.
 * Ensures sales reps / team members can only view, edit, or interact with leads assigned to them.
 */
async function enforceLeadAccess(req, res, next) {
  try {
    if (!req.user) {
      return authenticate(req, res, () => enforceLeadAccess(req, res, next));
    }

    const leadId = req.params.id;
    if (!leadId) return next();

    const rawRole = typeof req.user.role === 'string' ? req.user.role : (req.user.role?.name || '');
    const role = rawRole.toLowerCase().replace(/[\s_-]+/g, '');
    
    // Superadmin, admin, manager, gm bypass individual lead assignment ownership check
    if (['superadmin', 'admin', 'administrator', 'owner', 'manager', 'gm'].includes(role) || role.includes('admin') || role.includes('manager')) {
      return next();
    }

    const tenantId = req.tenantId || (req.user && req.user.tenantId);

    // Build SQL scope filter (defaults to l.assignee_id = userId for regular team members)
    const scopeFilter = dataScope.buildScopeFilter(req.user, 'leads', 'assignee_id', 'l');

    const query = `SELECT 1 FROM leads l WHERE l.id = $1 AND l.tenant_id = $2 AND (${scopeFilter})`;
    const { rows } = await pool.query(query, [leadId, tenantId]);

    if (rows.length === 0) {
      return res.status(403).json({
        success: false,
        error: 'ACCESS_DENIED',
        message: 'Access denied: You do not have permission to view or modify leads assigned to other team members.'
      });
    }

    next();
  } catch (error) {
    logger.error('[enforceLeadAccess] Error checking lead ownership access:', error);
    return next(error);
  }
}

module.exports = enforceLeadAccess;
