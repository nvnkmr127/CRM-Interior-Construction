const { fail } = require('../utils/response');

/**
 * Data Loss Prevention (DLP) Middleware
 * Prevents non-admin users from mass-exporting sensitive data.
 */
function dlpMiddleware(options = { maxLimit: 1000 }) {
  return (req, res, next) => {
    // Admins bypass DLP
    if (req.user?.role === 'admin' || req.user?.role === 'superadmin') {
      return next();
    }

    // Check if the route is an export route or trying to fetch a massive list
    const isExportRoute = req.originalUrl.includes('export') || req.originalUrl.includes('download');
    const requestedLimit = parseInt(req.query.limit, 10);

    if (isExportRoute) {
      console.warn(`[SECURITY DLP] Non-admin user ${req.user?.userId} attempted to export data on ${req.originalUrl}. Blocked.`);
      return res.status(403).json(fail('Data Loss Prevention (DLP): Export operations require administrator approval.'));
    }

    if (requestedLimit && requestedLimit > options.maxLimit) {
      console.warn(`[SECURITY DLP] User ${req.user?.userId} attempted to fetch ${requestedLimit} records (exceeds ${options.maxLimit}). Throttled.`);
      req.query.limit = options.maxLimit; // Hard cap the limit silently
    }

    next();
  };
}

module.exports = dlpMiddleware;
