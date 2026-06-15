// SALT_ROUNDS=12 takes ~250ms — intentional.
const bcrypt = require('bcryptjs');

const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password.
 * @param {string} plainText 
 * @returns {Promise<string>}
 */
async function hashPassword(plainText) {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a hash.
 * @param {string} plainText 
 * @param {string} hash 
 * @returns {Promise<boolean>}
 */
async function verifyPassword(plainText, hash) {
  return bcrypt.compare(plainText, hash);
}

module.exports = {
  hashPassword,
  verifyPassword,
};
