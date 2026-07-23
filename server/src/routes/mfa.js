const express = require('express');
const { z } = require('zod');
const { authenticator } = require('otplib');
const pool = require('../db/pool');
const { success, fail } = require('../utils/response');
const { signAccessToken, signRefreshToken } = require('../services/auth/tokens');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const router = express.Router();

const validateSchema = z.object({
  tempToken: z.string(),
  code: z.string().length(6),
  trustDevice: z.boolean().optional()
});

router.post('/validate', async (req, res, next) => {
  try {
    const parsed = validateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(fail('Invalid request payload'));

    const { tempToken, code, trustDevice } = parsed.data;

    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET || 'fallback_secret');
      if (!decoded.isMfaTemp) throw new Error('Invalid token type');
    } catch (e) {
      return res.status(401).json(fail('Invalid or expired temporary token'));
    }

    const { userId, tenantId, role, email, permissions } = decoded;

    const userSecRes = await pool.query('SELECT mfa_enabled, mfa_secret, mfa_method FROM user_security WHERE user_id = $1', [userId]);
    const userSecurity = userSecRes.rows[0] || {};

    let isValid = false;

    if (userSecurity.mfa_method === 'totp' && userSecurity.mfa_enabled) {
      isValid = authenticator.verify({ token: code, secret: userSecurity.mfa_secret });
    } else {
      // Check OTP in otp_codes table
      const codeHash = crypto.createHash('sha256').update(code).digest('hex');
      const otpRes = await pool.query(
        'DELETE FROM otp_codes WHERE user_id = $1 AND code_hash = $2 AND purpose = $3 AND expires_at > NOW() RETURNING id',
        [userId, codeHash, 'login']
      );
      isValid = otpRes.rowCount > 0;
    }

    if (!isValid) return res.status(401).json(fail('Invalid MFA code'));

    const payload = { userId, tenantId, role, email, permissions };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const ip = req.ip || req.connection?.remoteAddress || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    const sessionRes = await pool.query(`
      INSERT INTO sessions (user_id, tenant_id, token_hash, expires_at, ip_address, user_agent)
      VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', $4, $5) RETURNING id
    `, [userId, tenantId, tokenHash, ip, userAgent]);

    await pool.query(
      'UPDATE login_history SET status = $1, session_id = $2 WHERE user_id = $3 AND status = $4',
      ['success', sessionRes.rows[0].id, userId, 'success_mfa_pending']
    );

    let trustedDeviceToken = null;
    if (trustDevice) {
      const plainToken = crypto.randomBytes(32).toString('hex');
      const hashToken = crypto.createHash('sha256').update(plainToken).digest('hex');
      await pool.query(
        'INSERT INTO user_trusted_devices (user_id, device_fingerprint, device_name, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'30 days\')',
        [userId, hashToken, userAgent.substring(0, 50)]
      );
      trustedDeviceToken = plainToken;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = { httpOnly: true, secure: isProduction, sameSite: 'strict' };

    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });

    const responsePayload = { accessToken, refreshToken, user: { id: userId, email, role, permissions } };
    if (trustedDeviceToken) responsePayload.trustedDeviceToken = trustedDeviceToken;

    return success(res, responsePayload);

  } catch (err) {
    next(err);
  }
});

module.exports = router;
