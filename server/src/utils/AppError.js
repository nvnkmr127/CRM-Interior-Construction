class AppError extends Error {
  constructor(message, statusCode = 500, code = 'INTERNAL_ERROR', isValidation = false) {
    super(message);
    this.statusCode = statusCode;
    this.code = code;
    this.isValidation = isValidation;
    this.isOperational = true;

    Error.captureStackTrace(this, this.constructor);
  }
}

module.exports = AppError;
