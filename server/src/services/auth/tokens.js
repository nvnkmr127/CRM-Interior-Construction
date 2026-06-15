const jwt = require('jsonwebtoken');
const config = require('../../config/env');

class TokenExpiredError extends Error {
  constructor(message = 'Token expired') {
    super(message);
    this.name = 'TokenExpiredError';
  }
}

class TokenInvalidError extends Error {
  constructor(message = 'Token is invalid') {
    super(message);
    this.name = 'TokenInvalidError';
  }
}

/**
 * Signs an access token that expires in 15 minutes.
 * @param {Object} payload - { userId, tenantId, role, email }
 * @returns {string}
 */
function signAccessToken(payload) {
  return jwt.sign(payload, config.jwtSecret, { expiresIn: '15m' });
}

/**
 * Signs a refresh token that expires in 7 days.
 * @param {Object} payload - { userId, tenantId, role, email }
 * @returns {string}
 */
function signRefreshToken(payload) {
  return jwt.sign(payload, config.jwtRefreshSecret, { expiresIn: '7d' });
}

/**
 * Verifies an access token and returns the decoded payload.
 * @param {string} token 
 * @returns {Object}
 */
function verifyAccessToken(token) {
  try {
    return jwt.verify(token, config.jwtSecret);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError();
    }
    throw new TokenInvalidError(error.message);
  }
}

/**
 * Verifies a refresh token and returns the decoded payload.
 * @param {string} token 
 * @returns {Object}
 */
function verifyRefreshToken(token) {
  try {
    return jwt.verify(token, config.jwtRefreshSecret);
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new TokenExpiredError();
    }
    throw new TokenInvalidError(error.message);
  }
}

module.exports = {
  signAccessToken,
  signRefreshToken,
  verifyAccessToken,
  verifyRefreshToken,
  TokenExpiredError,
  TokenInvalidError,
};
