const crypto = require('crypto');
const pool = require('../../db/pool');

async function sendOtp(tenantId, phone) {
  // 1. Lookup client_portal_users
  const userResult = await pool.query(
    'SELECT id FROM client_portal_users WHERE tenant_id = $1 AND phone = $2',
    [tenantId, phone]
  );

  if (userResult.rows.length === 0) {
    throw new Error('CLIENT_NOT_FOUND');
  }

  // 2. Generate 6-digit OTP
  const otp = crypto.randomInt(100000, 999999).toString();

  // 3. Hash OTP
  const otpHash = crypto.createHash('sha256').update(otp).digest('hex');

  // 4. Store in DB (10 mins expiry)
  await pool.query(
    `UPDATE client_portal_users
     SET otp_hash = $1, otp_expires_at = NOW() + INTERVAL '10 minutes'
     WHERE tenant_id = $2 AND phone = $3`,
    [otpHash, tenantId, phone]
  );

  // 5. STUB: log 'OTP for ${phone}: ${otp}' to console.
  console.log(`OTP for ${phone}: ${otp}`);

  // Real WhatsApp send via WABA in Phase 2 — use config.wabaToken when set.
}

async function verifyOtp(tenantId, phone, submittedOtp) {
  // 1. Lookup portal user
  const userResult = await pool.query(
    'SELECT id, otp_hash, otp_expires_at, project_id, name FROM client_portal_users WHERE tenant_id = $1 AND phone = $2',
    [tenantId, phone]
  );

  const user = userResult.rows[0];
  if (!user) {
    throw new Error('CLIENT_NOT_FOUND');
  }

  // 2. Check expiry
  if (!user.otp_expires_at || new Date(user.otp_expires_at) < new Date()) {
    throw new Error('OTP_EXPIRED');
  }

  // 3. Hash submitted OTP and compare
  const submittedOtpHash = crypto.createHash('sha256').update(submittedOtp).digest('hex');
  if (submittedOtpHash !== user.otp_hash) {
    throw new Error('OTP_INVALID');
  }

  // 4. Generate portal token
  const portalToken = crypto.randomBytes(32).toString('hex');

  // 5. Hash and store
  const portalTokenHash = crypto.createHash('sha256').update(portalToken).digest('hex');

  // 6. Update last_login_at
  await pool.query(
    `UPDATE client_portal_users
     SET portal_token_hash = $1, portal_token_expires_at = NOW() + INTERVAL '30 days', last_login_at = NOW()
     WHERE id = $2`,
    [portalTokenHash, user.id]
  );

  // 7. Return { portalToken (raw), projectId, clientName }
  return {
    portalToken,
    projectId: user.project_id,
    clientName: user.name
  };
}

async function verifyOtpOnly(tenantId, phone, submittedOtp) {
  // 1. Lookup portal user
  const userResult = await pool.query(
    'SELECT id, otp_hash, otp_expires_at FROM client_portal_users WHERE tenant_id = $1 AND phone = $2',
    [tenantId, phone]
  );

  const user = userResult.rows[0];
  if (!user) {
    throw new Error('CLIENT_NOT_FOUND');
  }

  // 2. Check expiry
  if (!user.otp_expires_at || new Date(user.otp_expires_at) < new Date()) {
    throw new Error('OTP_EXPIRED');
  }

  // 3. Hash submitted OTP and compare
  const submittedOtpHash = crypto.createHash('sha256').update(submittedOtp).digest('hex');
  if (submittedOtpHash !== user.otp_hash) {
    throw new Error('OTP_INVALID');
  }

  // 4. Clear OTP
  await pool.query(
    `UPDATE client_portal_users
     SET otp_hash = NULL, otp_expires_at = NULL
     WHERE id = $1`,
    [user.id]
  );

  return true;
}

module.exports = {
  sendOtp,
  verifyOtp,
  verifyOtpOnly
};
