/**
 * Middleware factory to enforce Data Scope constraints based on role permissions.
 * 
 * @param {string} moduleName - The module name in the data_scopes configuration (e.g. 'projects', 'leads')
 * @param {string} ownerField - The column name referencing the owner/assignee (e.g. 'pm_id' or 'assigned_to'). Default is 'owner_id'
 * @param {string} tableAlias - Optional alias if the query is complex (e.g. 'p')
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
    const scope = scopes[moduleName] || 'assigned'; // Default to assigned if no scope is defined
    const userId = req.user.userId;
    const departmentId = req.user.departmentId || null;
    const branchId = req.user.branchId || null;
    
    // Support table alias if provided (e.g. "p.pm_id")
    const column = tableAlias ? `${tableAlias}.${ownerField}` : ownerField;

    switch (scope) {
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
      case 'department':
        // Can view records owned by users in the same department
        if (!departmentId) {
           req.scopeFilter = `${column} = '${userId}'`; // fallback
        } else {
           req.scopeFilter = `${column} IN (SELECT id FROM users WHERE department_id = '${departmentId}')`;
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
        req.scopeFilter = `${column} = '${userId}'`;
        break;
    }

    next();
  };
};

module.exports = dataScope;
