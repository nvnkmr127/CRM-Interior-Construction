const config = require('../config/env');

/**
 * Global error handler middleware.
 * Formats known errors into a standardized JSON response format.
 */
function errorHandler(err, req, res, next) {
  // Always log the full error server-side
  console.error('Global Error Handler caught:', err);

  const isProduction = config.nodeEnv === 'production';
  const response = {
    success: false,
  };

  // 1. Validation Errors
  if (err.isValidation) {
    response.error = { code: 'VALIDATION_ERROR', details: err.details };
    return res.status(400).json(response);
  }

  // 2. Named Errors Mapping
  switch (err.message) {
    case 'EMAIL_EXISTS':
      response.error = { code: 'EMAIL_EXISTS', message: 'Email already registered' };
      return res.status(409).json(response);
    case 'INVALID_CREDENTIALS':
      response.error = { code: 'INVALID_CREDENTIALS', message: 'Invalid email or password' };
      return res.status(401).json(response);
    case 'NOT_FOUND':
      response.error = { code: 'NOT_FOUND', message: 'Resource not found' };
      return res.status(404).json(response);
    case 'FORBIDDEN':
      response.error = { code: 'FORBIDDEN', message: 'Forbidden' };
      return res.status(403).json(response);
    case 'ACCOUNT_INACTIVE':
      response.error = { code: 'ACCOUNT_INACTIVE', message: 'Account is inactive' };
      return res.status(403).json(response);
    default:
      // 3. Default Fallback
      response.error = { code: 'INTERNAL_ERROR', message: 'Something went wrong' };
      
      // Include stack trace only in development
      if (!isProduction) {
        response.error.stack = err.stack;
      }
      
      return res.status(500).json(response);
  }
}

module.exports = errorHandler;
