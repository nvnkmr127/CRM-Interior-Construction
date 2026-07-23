const express = require('express');
const pool = require('../db/pool');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { success, fail } = require('../utils/response');
const { validatePasswordPolicy, hashPassword, recordPasswordChange } = require('../services/auth/password');
const { getCache, setCache } = require('../utils/cache');
const speakeasy = require('speakeasy');
const qrcode = require('qrcode');

const router = express.Router();

/**
 * ADMIN: Get Tenant Security Settings
 */
router.get('/settings', authenticate, authorize('tenant:manage'), async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT * FROM tenant_security_settings WHERE tenant_id = $1', [req.tenantId]);
    return success(res, rows[0] || {});
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', error.message, 500);
  }
});

/**
 * ADMIN: Update Tenant Security Settings
 */
router.put('/settings', authenticate, authorize('tenant:manage'), async (req, res) => {
  const {
    mfa_required_all, session_timeout_minutes, concurrent_login_limit,
    password_min_length, password_require_symbols, password_require_numbers,
    password_expiry_days, password_prevent_reuse, allowed_ips, allowed_countries
  } = req.body;

  try {
    const query = `
      UPDATE tenant_security_settings SET
        mfa_required_all = COALESCE($1, mfa_required_all),
        session_timeout_minutes = COALESCE($2, session_timeout_minutes),
        concurrent_login_limit = COALESCE($3, concurrent_login_limit),
        password_min_length = COALESCE($4, password_min_length),
        password_require_symbols = COALESCE($5, password_require_symbols),
        password_require_numbers = COALESCE($6, password_require_numbers),
        password_expiry_days = COALESCE($7, password_expiry_days),
        password_prevent_reuse = COALESCE($8, password_prevent_reuse),
        allowed_ips = COALESCE($9, allowed_ips),
        allowed_countries = COALESCE($10, allowed_countries),
        updated_at = NOW()
      WHERE tenant_id = $11 RETURNING *
    `;
    const { rows } = await pool.query(query, [
      mfa_required_all, session_timeout_minutes, concurrent_login_limit,
      password_min_length, password_require_symbols, password_require_numbers,
      password_expiry_days, password_prevent_reuse, 
      allowed_ips ? JSON.stringify(allowed_ips) : null, 
      allowed_countries ? JSON.stringify(allowed_countries) : null, 
      req.tenantId
    ]);

    // Update Cache
    const settingsCacheKey = `tenant_security:${req.tenantId}`;
    await setCache(settingsCacheKey, rows[0], 3600);

    return success(res, rows[0]);
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', error.message, 500);
  }
});

/**
 * USER: Get My Security Settings
 */
router.get('/my-security', authenticate, async (req, res) => {
  try {
    const secRes = await pool.query('SELECT mfa_enabled, mfa_method, last_password_change FROM user_security WHERE user_id = $1', [req.user.id]);
    const devRes = await pool.query('SELECT id, device_name, last_used_at, expires_at FROM user_trusted_devices WHERE user_id = $1 AND (expires_at IS NULL OR expires_at > NOW()) ORDER BY last_used_at DESC', [req.user.id]);
    
    return success(res, {
      security: secRes.rows[0],
      devices: devRes.rows
    });
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', error.message, 500);
  }
});

/**
 * USER: Setup MFA (Generate Secret & QR Code)
 */
router.post('/my-security/setup-mfa', authenticate, async (req, res) => {
  try {
    const secret = speakeasy.generateSecret({ name: `CRM (${req.user.email})` });
    const qrCodeDataUrl = await qrcode.toDataURL(secret.otpauth_url);
    return success(res, { secret: secret.base32, qrCodeDataUrl });
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', error.message, 500);
  }
});

/**
 * USER: Enable MFA (Verify OTP and save secret)
 */
router.post('/my-security/enable-mfa', authenticate, async (req, res) => {
  const { secret, token } = req.body;
  if (!secret || !token) return fail(res, 'VALIDATION_ERROR', 'Secret and token required', 400);

  const verified = speakeasy.totp.verify({ secret, encoding: 'base32', token, window: 1 });
  if (!verified) return fail(res, 'INVALID_OTP', 'Invalid verification code', 400);

  try {
    await pool.query('UPDATE user_security SET mfa_enabled = true, mfa_secret = $1, mfa_method = $2 WHERE user_id = $3', [secret, 'totp', req.user.id]);
    return success(res, { message: 'MFA Enabled' });
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', error.message, 500);
  }
});

/**
 * USER: Disable MFA
 */
router.post('/my-security/disable-mfa', authenticate, async (req, res) => {
  try {
    await pool.query('UPDATE user_security SET mfa_enabled = false, mfa_secret = NULL, mfa_method = $1 WHERE user_id = $2', ['email', req.user.id]);
    return success(res, { message: 'MFA Disabled' });
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', error.message, 500);
  }
});

/**
 * USER: Revoke Trusted Device
 */
router.delete('/my-security/devices/:deviceId', authenticate, async (req, res) => {
  try {
    await pool.query('DELETE FROM user_trusted_devices WHERE id = $1 AND user_id = $2', [req.params.deviceId, req.user.id]);
    return success(res, { message: 'Device revoked' });
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', error.message, 500);
  }
});

/**
 * USER: Change Password & Reset Password Expiry
 */
router.post('/my-security/change-password', authenticate, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return fail(res, 'VALIDATION_ERROR', 'New password is required', 400);

  try {
    await validatePasswordPolicy(newPassword, req.tenantId, req.user.id);
    const passwordHash = await hashPassword(newPassword);

    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, req.user.id]);
    await recordPasswordChange(req.user.id, passwordHash);

    return success(res, { message: 'Password changed successfully' });
  } catch (error) {
    return fail(res, 'VALIDATION_ERROR', error.message, 400);
  }
});

module.exports = router;
