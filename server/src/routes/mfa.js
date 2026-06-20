const express = require('express');
const { z } = require('zod');
const { authenticator } = require('otplib');
const qrcode = require('qrcode');
const pool = require('../db/pool');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');
const { signAccessToken, signRefreshToken } = require('../services/auth/tokens');
const crypto = require('crypto');
const jwt = require('jsonwebtoken');

const router = express.Router();

/**
 * 1. Setup MFA (Authenticated user)
 * Generates a TOTP secret and returns a QR code
 */
router.post('/setup', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const tenantId = req.tenantId;

    // Check if user already has MFA enabled
    const userRes = await pool.query(
      'SELECT mfa_enabled, email FROM users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );

    if (userRes.rows.length === 0) return res.status(404).json(fail('User not found'));
    const user = userRes.rows[0];

    // Generate new secret
    const secret = authenticator.generateSecret();
    const otpauth = authenticator.keyuri(user.email, 'CRM Portal', secret);
    const qrCodeUrl = await qrcode.toDataURL(otpauth);

    // Temporarily save secret in DB, but not enabled yet
    await pool.query(
      'UPDATE users SET mfa_secret = $1 WHERE id = $2 AND tenant_id = $3',
      [secret, userId, tenantId]
    );

    return success(res, { qrCodeUrl, secret });
  } catch (err) {
    next(err);
  }
});

/**
 * 2. Verify Setup (Authenticated user)
 * Verifies the TOTP code and enables MFA
 */
const verifySchema = z.object({
  code: z.string().length(6)
});

router.post('/verify', authenticate, async (req, res, next) => {
  try {
    const parsed = verifySchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(fail('Invalid code format'));

    const userId = req.user.id || req.user.userId;
    const tenantId = req.tenantId;
    const { code } = parsed.data;

    const userRes = await pool.query(
      'SELECT mfa_secret FROM users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );
    if (userRes.rows.length === 0) return res.status(404).json(fail('User not found'));

    const { mfa_secret } = userRes.rows[0];
    if (!mfa_secret) return res.status(400).json(fail('MFA not set up'));

    const isValid = authenticator.verify({ token: code, secret: mfa_secret });
    if (!isValid) return res.status(400).json(fail('Invalid MFA code'));

    await pool.query(
      'UPDATE users SET mfa_enabled = true WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );

    return success(res, { message: 'MFA enabled successfully' });
  } catch (err) {
    next(err);
  }
});

/**
 * 3. Validate MFA during Login
 * Exchanges temp token + code for real access & refresh tokens
 */
const validateSchema = z.object({
  tempToken: z.string(),
  code: z.string().length(6)
});

router.post('/validate', async (req, res, next) => {
  try {
    const parsed = validateSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json(fail('Invalid request payload'));

    const { tempToken, code } = parsed.data;

    // Verify temp token
    let decoded;
    try {
      decoded = jwt.verify(tempToken, process.env.JWT_SECRET || 'fallback_secret');
      if (!decoded.isMfaTemp) throw new Error('Invalid token type');
    } catch (e) {
      return res.status(401).json(fail('Invalid or expired temporary token'));
    }

    const { userId, tenantId, role, email, permissions } = decoded;

    // Fetch user mfa details
    const userRes = await pool.query(
      'SELECT mfa_secret, status FROM users WHERE id = $1 AND tenant_id = $2',
      [userId, tenantId]
    );

    if (userRes.rows.length === 0 || userRes.rows[0].status !== 'active') {
      return res.status(401).json(fail('User inactive or not found'));
    }

    const { mfa_secret } = userRes.rows[0];

    // Verify code
    const isValid = authenticator.verify({ token: code, secret: mfa_secret });
    if (!isValid) return res.status(401).json(fail('Invalid MFA code'));

    // Success! Issue real tokens
    const payload = { userId, tenantId, role, email, permissions };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    // Save session
    const ip = req.ip || req.connection?.remoteAddress || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    
    await pool.query(`
      INSERT INTO sessions (user_id, tenant_id, token_hash, expires_at, ip_address, user_agent)
      VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', $4, $5)
    `, [userId, tenantId, tokenHash, ip, userAgent]);

    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = { httpOnly: true, secure: isProduction, sameSite: 'strict' };

    res.cookie('refreshToken', refreshToken, { ...cookieOptions, maxAge: 7 * 24 * 60 * 60 * 1000 });
    res.cookie('accessToken', accessToken, { ...cookieOptions, maxAge: 15 * 60 * 1000 });

    return success(res, { accessToken, refreshToken, user: { id: userId, email, role, permissions } });

  } catch (err) {
    next(err);
  }
});

module.exports = router;
