const bcrypt = require('bcryptjs');
const pool = require('../../db/pool');
const { getCache, setCache } = require('../../utils/cache');

const SALT_ROUNDS = 12;

/**
 * Hash a plaintext password.
 */
async function hashPassword(plainText) {
  return bcrypt.hash(plainText, SALT_ROUNDS);
}

/**
 * Verify a plaintext password against a hash.
 */
async function verifyPassword(plainText, hash) {
  return bcrypt.compare(plainText, hash);
}

/**
 * Validates a password against tenant policies and user history.
 */
async function validatePasswordPolicy(plainText, tenantId, userId) {
  const settingsCacheKey = `tenant_security:${tenantId}`;
  let securitySettings = await getCache(settingsCacheKey).catch(() => null);
  
  if (!securitySettings) {
    const settingsRes = await pool.query('SELECT * FROM tenant_security_settings WHERE tenant_id = $1', [tenantId]);
    securitySettings = settingsRes.rows[0] || {};
    setCache(settingsCacheKey, securitySettings, 3600).catch(() => {});
  }

  // 1. Length
  const minLength = securitySettings.password_min_length || 8;
  if (plainText.length < minLength) {
    throw new Error(`Password must be at least ${minLength} characters long.`);
  }

  // 2. Symbols
  if (securitySettings.password_require_symbols) {
    if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]+/.test(plainText)) {
      throw new Error('Password must contain at least one special character.');
    }
  }

  // 3. Numbers
  if (securitySettings.password_require_numbers) {
    if (!/\d/.test(plainText)) {
      throw new Error('Password must contain at least one number.');
    }
  }

  // 4. History / Reuse
  if (userId && securitySettings.password_prevent_reuse > 0) {
    const historyRes = await pool.query(
      'SELECT password_hash FROM password_history WHERE user_id = $1 ORDER BY created_at DESC LIMIT $2',
      [userId, securitySettings.password_prevent_reuse]
    );
    for (let row of historyRes.rows) {
      const isMatch = await bcrypt.compare(plainText, row.password_hash);
      if (isMatch) {
        throw new Error(`Password has been used recently. Please choose a new one.`);
      }
    }
  }

  return true;
}

/**
 * Records a new password in the user's history and updates the user_security table.
 */
async function recordPasswordChange(userId, passwordHash) {
  await pool.query('INSERT INTO password_history (user_id, password_hash) VALUES ($1, $2)', [userId, passwordHash]);
  await pool.query('UPDATE user_security SET last_password_change = NOW() WHERE user_id = $1', [userId]);
}

module.exports = {
  hashPassword,
  verifyPassword,
  validatePasswordPolicy,
  recordPasswordChange
};
