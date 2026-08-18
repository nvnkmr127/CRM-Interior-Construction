const logger = require('../utils/logger');
const config = require('../config/env');
/**
 * Global error handler middleware.
 * Formats known errors into a standardized JSON response format.
 */
function errorHandler(error, req, res, next) {
  // Always log the full error server-side
  logger.error(error, 'Global Error Handler caught an error');
  
  try {
    require('fs').appendFileSync('d:/Digicloudify softwares/CRM-Interior-Construction/server/error_log.txt', new Date().toISOString() + '\\n' + (error.stack || error.message) + '\\n\\n');
  } catch(e) {}

  const isProduction = config.nodeEnv === 'production';
  const response = {
    success: false,
  };

  // 1. Validation Errors
  if (error.isValidation) {
    response.error = { code: 'VALIDATION_ERROR', details: error.details };
    return res.status(400).json(response);
  }

  // 2. Custom AppError instances
  if (error.isOperational) {
    response.error = { code: error.code, message: error.message };
    return res.status(error.statusCode).json(response);
  }

  // 3. Fallback for unhandled/native errors
  // To keep compatibility with any legacy throw new Error('STRING') before full refactor:
  switch (error.message) {
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
    case 'STAGE_GATE_FAILED':
      response.error = { code: 'STAGE_GATE_FAILED', message: 'Missing mandatory fields', missing: error.missing || [] };
      return res.status(400).json(response);
    case 'OPTIMISTIC_LOCK_FAILED':
      response.error = { code: 'OPTIMISTIC_LOCK_FAILED', message: 'This lead has been modified by someone else since you last fetched it.' };
      return res.status(409).json(response);
    default:
      if (error.message && error.message.startsWith('POLICY_VIOLATION')) {
        response.error = { code: 'POLICY_VIOLATION', message: error.message };
        return res.status(403).json(response);
      }
      if (error.message && error.message.startsWith('VALIDATION_ERROR:')) {
        response.error = { code: 'VALIDATION_ERROR', message: error.message.split('VALIDATION_ERROR:')[1].trim() };
        return res.status(400).json(response);
      }
      response.error = { 
        code: 'INTERNAL_ERROR', 
        message: isProduction ? 'Something went wrong' : (error.message || 'Something went wrong')
      };
      if (!isProduction) {
        response.error.details = error.stack || String(error);
      }
      return res.status(500).json(response);
  }
}

module.exports = errorHandler;
