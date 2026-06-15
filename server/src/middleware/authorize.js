/**
 * Express middleware factory to authorize API requests based on permissions.
 * @param {string} requiredPermission 
 * @returns {Function} Express middleware function
 */
function authorize(requiredPermission) {
  return (req, res, next) => {
    // Ensure req.user is set (this should be handled by the authenticate middleware)
    if (!req.user) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    }

    // 2. If user is a superadmin, bypass permission checks
    if (req.user.role === 'superadmin') {
      return next();
    }

    // 1. req.user.permissions should be an array of strings
    const permissions = req.user.permissions || [];

    // 3. If the required permission is present, proceed
    if (permissions.includes(requiredPermission)) {
      return next();
    }

    // 4. Otherwise, return 403 Forbidden with details
    return res.status(403).json({
      success: false,
      error: 'FORBIDDEN',
      required: requiredPermission
    });
  };
}

module.exports = authorize;
