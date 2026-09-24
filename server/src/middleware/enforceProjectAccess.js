const logger = require('../utils/logger');
const pool = require('../config/db');
const dataScope = require('./dataScope');
/**
 * Middleware to enforce project-level access for direct /projects/:id routes.
 * It uses the existing dataScope logic to construct a filter and checks against the DB.
 */
async function enforceProjectAccess(req, res, next, id) {
  try {
    if (!req.user) {
      console.error('[enforceProjectAccess] returning 401 because req.user is undefined! Path:', req.path);
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'enforceProjectAccess: req.user is undefined' });
    }
    
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Tenant context missing' });
    }

    // Verify the project exists in this tenant
    const { rows: projRows } = await pool.query(
      'SELECT 1 FROM projects WHERE id = $1 AND tenant_id = $2',
      [id, tenantId]
    );

    if (projRows.length === 0) {
      // Allow if this ID is a task or leave from resource_allocations (for Resource Capacity page)
      try {
        const { rows: raRows } = await pool.query(
          'SELECT entity_type FROM resource_allocations WHERE entity_id = $1 AND tenant_id = $2 LIMIT 1',
          [id, tenantId]
        );
        if (raRows.length > 0 && raRows[0].entity_type !== 'project') {
          return next();
        }
      } catch (error) {
        // Ignore invalid UUID error
      }
      return res.status(404).json({ success: false, error: 'NOT_FOUND', message: 'Project not found in this workspace' });
    }

    // Admin / Superadmin / Owner override for projects belonging to THIS workspace
    const userRole = typeof req.user.role === 'string' ? req.user.role.toLowerCase().replace(/[\s_-]+/g, '') : (req.user.role?.name ? req.user.role.name.toLowerCase() : '');
    if (userRole === 'superadmin' || userRole === 'admin' || userRole === 'owner' || userRole === 'administrator' || userRole.includes('admin')) {
      return next();
    }

    // Temporarily apply dataScope to a mock req to get the SQL filter
    const mockReq = { user: req.user };
    let filter = '1=0';
    dataScope('projects', 'pm_id', 'p')(mockReq, res, () => {
      filter = mockReq.scopeFilter;
    });

    const query = `SELECT 1 FROM projects p WHERE p.id = $1 AND p.tenant_id = $2 AND (${filter})`;
    const { rows } = await pool.query(query, [id, req.tenantId]);

    if (rows.length === 0) {
      // The user failed the general dataScope check. 
      // Are they explicitly assigned via project_members?
      const userId = req.user.id || req.user.userId;
      const pmCheck = await pool.query(
        'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2 AND tenant_id = $3',
        [id, userId, req.tenantId]
      );
      const taskCheck = await pool.query(
        'SELECT 1 FROM tasks WHERE project_id = $1 AND assignee_id = $2 AND tenant_id = $3 AND deleted_at IS NULL LIMIT 1',
        [id, userId, req.tenantId]
      );
      if (pmCheck.rows.length === 0 && taskCheck.rows.length === 0) {
        return res.status(403).json({ success: false, error: 'Access denied. You are not assigned to this project.' });
      }
    }

    next();
  } catch (error) {
    logger.error('[enforceProjectAccess]', error);
    return next(error);
  }
}

module.exports = enforceProjectAccess;
