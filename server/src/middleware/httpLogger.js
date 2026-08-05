const logger = require('../utils/logger');
/**
 * Custom HTTP logging middleware using Pino.
 * Replaces morgan to provide structured JSON logging.
 */
function httpLogger(req, res, next) {
  const start = Date.now();

  res.on('finish', () => {
    const duration = Date.now() - start;
    const logData = {
      method: req.method,
      url: req.originalUrl || req.url,
      status: res.statusCode,
      durationMs: duration,
      ip: req.ip || req.connection.remoteAddress,
      userAgent: req.get('user-agent') || ''
    };

    if (res.statusCode >= 500) {
      logger.error(logData, 'HTTP Request Failed');
    } else if (res.statusCode >= 400) {
      logger.warn(logData, 'HTTP Request Client Error');
    } else {
      logger.info(logData, 'HTTP Request Success');
    }
  });

  next();
}

module.exports = httpLogger;
