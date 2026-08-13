/**
 * Middleware factory to enforce Data Scope constraints based on role permissions.
 * 
 * @param {string} moduleName - The module name in the data_scopes configuration (error.g. 'projects', 'leads')
 * @param {string} ownerField - The column name referencing the owner/assignee (error.g. 'pm_id' or 'assigned_to'). Default is 'owner_id'
 * @param {string} tableAlias - Optional alias if the query is complex (error.g. 'p')
 * @returns {Function} Express middleware that attaches a SQL filter string to req.scopeFilter
 */
const dataScope = (moduleName, ownerField = 'owner_id', tableAlias = '') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    }

    // Superadmin bypass
    if (req.user.role === 'superadmin') {
      req.scopeFilter = '1=1'; // Allow all
      return next();
    }

    const scopes = req.user.data_scopes || {};
    const rawScope = scopes[moduleName] || 'assigned'; // Default to assigned if no scope is defined
    const userId = req.user.userId;
    const departmentId = req.user.departmentId || null;
    const branchId = req.user.branchId || null;
    
    // Support table alias if provided (error.g. "p.pm_id")
    const column = tableAlias ? `${tableAlias}.${ownerField}` : ownerField;

    let scopeType = rawScope;
    let scopeIds = [];

    if (typeof rawScope === 'object' && rawScope !== null) {
      scopeType = rawScope.type || 'assigned';
      scopeIds = Array.isArray(rawScope.ids) ? rawScope.ids : [];
    }

    switch (scopeType) {
      case 'all':
        // Can view company records
        req.scopeFilter = '1=1';
        break;
      case 'branch':
        // Can view records owned by users in the same branch
        if (!branchId) {
           req.scopeFilter = `${column} = '${userId}'`; // fallback
        } else {
           req.scopeFilter = `${column} IN (SELECT id FROM users WHERE branch_id = '${branchId}')`;
        }
        break;
      case 'specific_branches':
        if (scopeIds.length === 0) {
          req.scopeFilter = '1=0'; // Block all if no branches selected
        } else {
          const ids = scopeIds.map(id => `'${id}'`).join(',');
          req.scopeFilter = `${column} IN (SELECT id FROM users WHERE branch_id IN (${ids}))`;
        }
        break;
      case 'department':
        // Can view records owned by users in the same department
        if (!departmentId) {
           req.scopeFilter = `${column} = '${userId}'`; // fallback
        } else {
           req.scopeFilter = `${column} IN (SELECT id FROM users WHERE department_id = '${departmentId}')`;
        }
        break;
      case 'specific_departments':
        if (scopeIds.length === 0) {
          req.scopeFilter = '1=0';
        } else {
          const ids = scopeIds.map(id => `'${id}'`).join(',');
          req.scopeFilter = `${column} IN (SELECT id FROM users WHERE department_id IN (${ids}))`;
        }
        break;
      case 'team':
        // Simple team implementation (could check manager_id or a specific team_id)
        req.scopeFilter = `${column} IN (SELECT id FROM users WHERE manager_id = (SELECT manager_id FROM users WHERE id = '${userId}') OR id = '${userId}')`;
        break;
      case 'assigned':
      case 'own':
      default:
        // By default, restrict to own/assigned records
        if (moduleName === 'projects') {
          const table = tableAlias ? tableAlias + '.id' : 'id';
          const createdByCol = tableAlias ? `${tableAlias}.created_by` : 'created_by';
          req.scopeFilter = `(${column} = '${userId}' OR ${createdByCol} = '${userId}' OR ${table} IN (SELECT project_id FROM project_members WHERE user_id = '${userId}'))`;
        } else {
          req.scopeFilter = `${column} = '${userId}'`;
        }
        break;
    }

    next();
  };
};

module.exports = dataScope;
