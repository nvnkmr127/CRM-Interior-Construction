const pool = require('../config/db');
const dataScope = require('./dataScope');

/**
 * Middleware to enforce project-level access for direct /projects/:id routes.
 * It uses the existing dataScope logic to construct a filter and checks against the DB.
 */
async function enforceProjectAccess(req, res, next, id) {
  try {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    }
    
    // Superadmin override
    if (req.user.role === 'superadmin') {
      return next();
    }

    // Allow if this ID is a task or leave from resource_allocations (for Resource Capacity page)
    // We catch potential UUID syntax errors if 'id' is not a valid UUID format
    try {
      const { rows: raRows } = await pool.query('SELECT entity_type FROM resource_allocations WHERE entity_id = $1 LIMIT 1', [id]);
      if (raRows.length > 0 && raRows[0].entity_type !== 'project') {
        return next();
      }
    } catch (e) {
      // Ignore invalid UUID error, proceed to normal project check
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
      const pmCheck = await pool.query(
        'SELECT 1 FROM project_members WHERE project_id = $1 AND user_id = $2 AND tenant_id = $3',
        [id, req.user.userId, req.tenantId]
      );
      if (pmCheck.rows.length === 0) {
        return res.status(403).json({ success: false, error: 'Access denied. You are not assigned to this project.' });
      }
    }

    next();
  } catch (error) {
    console.error('[enforceProjectAccess]', error);
    return res.status(500).json({ success: false, error: 'Internal error checking project access' });
  }
}

module.exports = enforceProjectAccess;
