const express = require('express');
const router = express.Router();
const pool = require('../../db/pool');
const portalAuthService = require('../../services/portal/portalAuthService');

// POST /api/portal/auth/send-otp
router.post('/send-otp', async (req, res, next) => {
  try {
    const { phone, tenantSlug } = req.body;
    if (!phone || !tenantSlug) {
      return res.status(400).json({ success: false, message: 'Missing phone or tenantSlug' });
    }

    // 1. Resolve tenantId
    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE slug = $1',
      [tenantSlug]
    );
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }
    const tenantId = tenantResult.rows[0].id;

    // Rate limit check: max 3 OTP requests per phone per 10 minutes
    const rateLimitResult = await pool.query(
      `SELECT COUNT(*) FROM portal_otp_requests 
       WHERE phone = $1 AND tenant_id = $2 
       AND requested_at > NOW() - INTERVAL '10 minutes'`,
      [phone, tenantId]
    );
    if (parseInt(rateLimitResult.rows[0].count) >= 3) {
      return res.status(429).json({ success: false, message: 'Too many requests. Please try again later.' });
    }

    // Track request for rate limiting
    await pool.query(
      `INSERT INTO portal_otp_requests (phone, tenant_id) VALUES ($1, $2)`,
      [phone, tenantId]
    );

    // 2. sendOtp
    await portalAuthService.sendOtp(tenantId, phone);

    // 3. Return 200
    res.json({ success: true, message: 'OTP sent to your WhatsApp/SMS' });

  } catch (error) {
    if (error.message === 'CLIENT_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    next(error);
  }
});

// POST /api/portal/auth/verify-otp
router.post('/verify-otp', async (req, res, next) => {
  try {
    const { phone, otp, tenantSlug } = req.body;
    if (!phone || !otp || !tenantSlug) {
      return res.status(400).json({ success: false, message: 'Missing parameters' });
    }

    // 1. Resolve tenantId
    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE slug = $1',
      [tenantSlug]
    );
    if (tenantResult.rows.length === 0) {
      return res.status(404).json({ success: false, message: 'Tenant not found' });
    }
    const tenantId = tenantResult.rows[0].id;

    // 2. verifyOtp
    const { portalToken, projectId, clientName } = await portalAuthService.verifyOtp(tenantId, phone, otp);

    // 3. Set portalToken as httpOnly cookie (30 days)
    res.cookie('portalToken', portalToken, {
      httpOnly: true,
      secure: process.env.NODE_ENV === 'production',
      maxAge: 30 * 24 * 60 * 60 * 1000 // 30 days
    });

    // 4. Return 200
    res.json({ success: true, data: { projectId, clientName } });

  } catch (error) {
    if (error.message === 'OTP_EXPIRED') {
      return res.status(401).json({ success: false, message: 'OTP expired' });
    }
    if (error.message === 'OTP_INVALID') {
      return res.status(401).json({ success: false, message: 'Invalid OTP' });
    }
    if (error.message === 'CLIENT_NOT_FOUND') {
      return res.status(404).json({ success: false, message: 'Client not found' });
    }
    next(error);
  }
});

// POST /api/portal/auth/logout
router.post('/logout', async (req, res) => {
  res.clearCookie('portalToken');
  if (req.portalUser && req.portalUser.id) {
    await pool.query('UPDATE client_portal_users SET portal_token_hash=NULL WHERE id=$1', [req.portalUser.id]);
  }
  return res.status(204).end();
});

module.exports = router;
