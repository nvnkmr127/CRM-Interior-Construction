const pool = require('../db/pool');

/**
 * Middleware to log API requests for developers.
 * Needs to be placed AFTER `apiAuth` so `req.tenantId` and `req.apiKeyId` are available.
 */
const apiLogger = (req, res, next) => {
  // If the request doesn't have an API key, don't log it in developer logs
  if (!req.apiKeyId || !req.tenantId) {
    return next();
  }

  const startTime = Date.now();
  const endpoint = req.originalUrl;
  const method = req.method;
  const ipAddress = req.ip || req.connection.remoteAddress;

  res.on('finish', () => {
    const executionTimeMs = Date.now() - startTime;
    const statusCode = res.statusCode;

    // Log asynchronously
    pool.query(
      `INSERT INTO api_logs (tenant_id, api_key_id, endpoint, method, status_code, ip_address, execution_time_ms)
       VALUES ($1, $2, $3, $4, $5, $6, $7)`,
      [req.tenantId, req.apiKeyId, endpoint, method, statusCode, ipAddress, executionTimeMs]
    ).catch(err => {
      console.error('Failed to write API log:', err);
    });
  });

  next();
};

module.exports = apiLogger;
