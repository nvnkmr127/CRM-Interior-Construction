/**
 * Middleware factory to enforce Data Scope constraints based on role permissions.
 * 
 * @param {string} moduleName - The module name in the data_scopes configuration (error.g. 'projects', 'leads')
 * @param {string} ownerField - The column name referencing the owner/assignee (error.g. 'pm_id' or 'assigned_to'). Default is 'owner_id'
 * @param {string} tableAlias - Optional alias if the query is complex (error.g. 'p')
 * @returns {Function} Express middleware that attaches a SQL filter string to req.scopeFilter
 */
const buildScopeFilter = (user, moduleName, ownerField = 'owner_id', tableAlias = '') => {
  if (!user) return '1=0';
  if (user.role === 'superadmin') return '1=1';

  const scopes = user.data_scopes || {};
  const rawScope = scopes[moduleName] || 'assigned'; // Default to assigned if no scope is defined
  const userId = user.userId || user.id;
  const departmentId = user.departmentId || null;
  const branchId = user.branchId || null;
  
  // Support table alias if provided (e.g. "p.pm_id")
  const column = tableAlias ? `${tableAlias}.${ownerField}` : ownerField;

  let scopeType = rawScope;
  let scopeIds = [];

  if (typeof rawScope === 'object' && rawScope !== null) {
    scopeType = rawScope.type || 'assigned';
    scopeIds = Array.isArray(rawScope.ids) ? rawScope.ids : [];
  }

  let filter = '';
  switch (scopeType) {
    case 'all':
      filter = '1=1';
      break;
    case 'branch':
      if (!branchId) {
         filter = `${column} = '${userId}'`;
      } else {
         filter = `${column} IN (SELECT id FROM users WHERE branch_id = '${branchId}')`;
      }
      break;
    case 'specific_branches':
      if (scopeIds.length === 0) {
        filter = '1=0';
      } else {
        const ids = scopeIds.map(id => `'${id}'`).join(',');
        filter = `${column} IN (SELECT id FROM users WHERE branch_id IN (${ids}))`;
      }
      break;
    case 'department':
      if (!departmentId) {
         filter = `${column} = '${userId}'`;
      } else {
         filter = `${column} IN (SELECT id FROM users WHERE department_id = '${departmentId}')`;
      }
      break;
    case 'specific_departments':
      if (scopeIds.length === 0) {
        filter = '1=0';
      } else {
        const ids = scopeIds.map(id => `'${id}'`).join(',');
        filter = `${column} IN (SELECT id FROM users WHERE department_id IN (${ids}))`;
      }
      break;
    case 'team':
      filter = `${column} IN (SELECT id FROM users WHERE manager_id = (SELECT manager_id FROM users WHERE id = '${userId}') OR id = '${userId}')`;
      break;
    case 'assigned':
    case 'own':
    default:
      if (moduleName === 'projects') {
        const table = tableAlias ? tableAlias + '.id' : 'id';
        const createdByCol = tableAlias ? `${tableAlias}.created_by` : 'created_by';
        filter = `(${column} = '${userId}' OR ${createdByCol} = '${userId}' OR ${table} IN (SELECT project_id FROM project_members WHERE user_id = '${userId}'))`;
      } else {
        filter = `${column} = '${userId}'`;
      }
      break;
  }
  return filter;
};

const dataScope = (moduleName, ownerField = 'owner_id', tableAlias = '') => {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    }

    req.scopeFilter = buildScopeFilter(req.user, moduleName, ownerField, tableAlias);
    next();
  };
};

dataScope.buildScopeFilter = buildScopeFilter;

module.exports = dataScope;
