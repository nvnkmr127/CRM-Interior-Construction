/**
 * Express middleware to authorize API requests based on user role.
 * @param {string|string[]} allowedRoles 
 * @returns {Function} Express middleware function
 */
function requireRole(allowedRoles) {
  return (req, res, next) => {
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    }

    if (req.user.role === 'superadmin') {
      return next();
    }

    const roles = Array.isArray(allowedRoles) ? allowedRoles : [allowedRoles];

    if (roles.includes(req.user.role)) {
      return next();
    }

    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      requiredRoles: roles
    });
  };
}

module.exports = requireRole;
