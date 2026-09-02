const ACTION_ALIASES = {
  read: ['view', 'read', 'list', 'get', 'display', 'show', 'details', 'see'],
  view: ['view', 'read', 'list', 'get', 'display', 'show', 'details', 'see'],
  list: ['view', 'read', 'list', 'get', 'display', 'show', 'details', 'see'],
  get: ['view', 'read', 'list', 'get', 'display', 'show', 'details', 'see'],
  display: ['view', 'read', 'list', 'get', 'display', 'show', 'details', 'see'],
  show: ['view', 'read', 'list', 'get', 'display', 'show', 'details', 'see'],

  update: ['edit', 'update', 'modify', 'patch', 'put', 'manage', 'write'],
  edit: ['edit', 'update', 'modify', 'patch', 'put', 'manage', 'write'],
  modify: ['edit', 'update', 'modify', 'patch', 'put', 'manage', 'write'],
  manage: ['manage', 'edit', 'update', 'modify', 'patch', 'put', 'create', 'delete', 'view', 'read', 'invite_user', 'deactivate_user', 'activate_user', 'display', 'show', 'write'],

  create: ['create', 'add', 'insert', 'write', 'post', 'manage', 'invite_user'],
  add: ['create', 'add', 'insert', 'write', 'post', 'manage', 'invite_user'],
  write: ['create', 'add', 'insert', 'write', 'post', 'manage', 'edit', 'update', 'modify'],

  delete: ['delete', 'remove', 'destroy', 'manage', 'delete_user'],
  remove: ['delete', 'remove', 'destroy', 'manage'],

  invite: ['invite_user', 'invite', 'create', 'add', 'manage'],
  invite_user: ['invite_user', 'invite', 'create', 'add', 'manage'],
  activate: ['activate_user', 'activate', 'edit', 'update', 'manage'],
  activate_user: ['activate_user', 'activate', 'edit', 'update', 'manage'],
  deactivate: ['deactivate_user', 'deactivate', 'edit', 'update', 'manage'],
  deactivate_user: ['deactivate_user', 'deactivate', 'edit', 'update', 'manage']
};

function hasMatchingPermission(required, permissions) {
  if (!required) return true;
  if (!Array.isArray(permissions) || permissions.length === 0) return false;

  // Global wildcard
  if (permissions.includes('*') || permissions.includes('*:*')) {
    return true;
  }

  // Exact match
  if (permissions.includes(required)) {
    return true;
  }

  // Handle colon format: "module:action" (e.g. "leads:read", "projects:update")
  const parts = required.split(':');
  if (parts.length === 2) {
    const [mod, act] = parts;

    // Module wildcard: "leads:*" or "projects:*"
    if (permissions.includes(`${mod}:*`)) {
      return true;
    }

    // Check alias mapping
    const aliases = ACTION_ALIASES[act] || [act];
    for (const alias of aliases) {
      if (permissions.includes(`${mod}:${alias}`)) {
        return true;
      }
    }
  }

  return false;
}

/**
 * Express middleware factory to authorize API requests based on permissions.
 * @param {string|string[]} requiredPermission 
 * @returns {Function} Express middleware function
 */
function authorize(requiredPermission) {
  return (req, res, next) => {
    // Ensure req.user is set (this should be handled by the authenticate middleware)
    if (!req.user) {
      console.error('[authorize] returning 401 because req.user is undefined! Path:', req.path);
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'authorize: req.user is undefined' });
    }

    // Normalize user role to handle variations like 'superadmin', 'super admin', 'admin', 'administrator', 'owner'
    const userRole = typeof req.user.role === 'string' ? req.user.role.toLowerCase().replace(/[\s_-]+/g, '') : '';

    // If user is a superadmin, admin, administrator, or owner, bypass permission checks
    if (userRole === 'superadmin' || userRole === 'admin' || userRole === 'administrator' || userRole === 'owner' || userRole.includes('admin')) {
      return next();
    }

    // req.user.permissions should be an array of strings
    let permissions = req.user.permissions || [];
    if (!Array.isArray(permissions) && typeof permissions === 'object' && permissions.actions) {
      permissions = permissions.actions;
    }

    if (permissions.includes('*') || permissions.includes('*:*') || permissions.includes('all')) {
      return next();
    }

    // If requiredPermission is an array, any match suffices
    const hasRequired = Array.isArray(requiredPermission)
      ? requiredPermission.some(p => p === userRole || hasMatchingPermission(p, permissions))
      : (requiredPermission === userRole || hasMatchingPermission(requiredPermission, permissions));

    if (hasRequired || (process.env.NODE_ENV !== 'production' && permissions.length === 0)) {
      return next();
    }

    // Otherwise, return 403 Forbidden with details
    console.warn(`[authorize] 403 FORBIDDEN on path ${req.originalUrl || req.path}. Required: ${JSON.stringify(requiredPermission)}. User Role: '${userRole}'. User Permissions: ${JSON.stringify(permissions)}`);
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      required: requiredPermission
    });
  };
}

module.exports = authorize;
