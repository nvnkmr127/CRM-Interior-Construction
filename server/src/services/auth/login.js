const crypto = require('crypto');
const pool = require('../../db/pool');
const { queueEmail } = require('../emailService');
const { logAction } = require('../auditLog');
const { verifyPassword } = require('./password');
const { signAccessToken, signRefreshToken } = require('./tokens');
const UAParser = require('ua-parser-js');
let geoip;
try {
  geoip = require('geoip-lite');
} catch (e) {
  geoip = { lookup: () => null };
}
const { getCache, setCache } = require('../../utils/cache');

async function recordLoginHistory({ tenantId, userId, sessionId, emailAttempted, ip, userAgent, status, failureReason }) {
  try {
    const parser = new UAParser(userAgent);
    const browser = parser.getBrowser().name || 'Unknown';
    const os = parser.getOS().name || 'Unknown';
    const device = parser.getDevice().type || 'Desktop';
    
    const geo = geoip.lookup(ip);
    const location = geo ? `${geo.city || ''} ${geo.country || ''}`.trim() || 'Unknown' : 'Unknown';

    await pool.query(`
      INSERT INTO login_history (
        tenant_id, user_id, session_id, email_attempted, 
        ip_address, user_agent, browser, os, device, location, 
        status, failure_reason
      ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `, [
      tenantId, userId, sessionId, emailAttempted, 
      ip, userAgent, browser, os, device, location, 
      status, failureReason
    ]);
  } catch (err) {
    console.error('Failed to log login history:', err);
  }
}

async function loginUser({ email, password, tenantId, ip, userAgent, trustedDeviceToken }) {
  let user = null;
  let securitySettings = null;
  let userSecurity = null;
  
  try {
    // 0. Get Tenant Security Settings
    const settingsCacheKey = `tenant_security:${tenantId}`;
    securitySettings = await getCache(settingsCacheKey).catch(() => null);
    if (!securitySettings) {
      const settingsRes = await pool.query('SELECT * FROM tenant_security_settings WHERE tenant_id = $1', [tenantId]);
      securitySettings = settingsRes.rows[0] || {};
      setCache(settingsCacheKey, securitySettings, 3600).catch(() => {});
    }

    // 0.1 Check Geo-IP & IP Allowlist
    const geo = geoip.lookup(ip);
    const countryCode = geo ? geo.country : 'Unknown';

    if (securitySettings.allowed_countries && securitySettings.allowed_countries.length > 0) {
      if (!securitySettings.allowed_countries.includes(countryCode)) {
        throw new Error('GEO_BLOCKED');
      }
    }
    
    if (securitySettings.allowed_ips && securitySettings.allowed_ips.length > 0) {
      if (!securitySettings.allowed_ips.includes(ip)) {
        throw new Error('IP_BLOCKED');
      }
    }

    // 1. Find user by tenant_id + email, include role policies
    const userResult = await pool.query(
      `SELECT u.*, r.security_policies, r.name as role_name, r.permissions as role_permissions 
       FROM users u 
       LEFT JOIN roles r ON u.role_id = r.id 
       WHERE u.tenant_id = $1 AND u.email = $2 LIMIT 1`,
      [tenantId, email]
    );

    if (userResult.rows.length === 0) {
      throw new Error('INVALID_CREDENTIALS');
    }

    user = userResult.rows[0];

    // 2. Check user security & lockout
    const userSecResult = await pool.query('SELECT * FROM user_security WHERE user_id = $1', [user.id]);
    userSecurity = userSecResult.rows[0] || { failed_login_attempts: 0 };

    if (userSecurity.lockout_until && new Date(userSecurity.lockout_until) > new Date()) {
      throw new Error('ACCOUNT_LOCKED');
    }

    if (user.status !== 'active') {
      throw new Error('ACCOUNT_INACTIVE');
    }

    // 2.5 Evaluate Role Security Policies
    const policies = user.security_policies || {};
    // Bypass for superadmin unless explicitly restricted (we assume superadmin bypasses to avoid lockout)
    if (user.role_name !== 'superadmin') {
      const now = new Date();
      
      // Allowed Days
      if (policies.allowed_days && policies.allowed_days.length > 0) {
        const currentDay = now.getDay(); // 0 (Sun) to 6 (Sat)
        if (!policies.allowed_days.includes(currentDay)) {
          throw new Error('POLICY_VIOLATION: DAY_RESTRICTION');
        }
      }

      // Allowed Login Times
      if (policies.allowed_login_times && policies.allowed_login_times.start && policies.allowed_login_times.end) {
        // Simple string comparison HH:mm
        const currentHourStr = now.getHours().toString().padStart(2, '0') + ':' + now.getMinutes().toString().padStart(2, '0');
        if (currentHourStr < policies.allowed_login_times.start || currentHourStr > policies.allowed_login_times.end) {
          throw new Error('POLICY_VIOLATION: TIME_RESTRICTION');
        }
      }

      // Allowed IPs
      if (policies.allowed_ips && policies.allowed_ips.length > 0) {
        if (!policies.allowed_ips.includes(ip)) {
          throw new Error('POLICY_VIOLATION: IP_RESTRICTION');
        }
      }

      // Allowed Devices & Trusted Browsers
      const parser = new UAParser(userAgent);
      const browserName = parser.getBrowser().name || 'Unknown';
      const deviceType = parser.getDevice().type || 'Desktop';

      if (policies.trusted_browsers && policies.trusted_browsers.length > 0) {
        if (!policies.trusted_browsers.includes(browserName)) {
          throw new Error('POLICY_VIOLATION: BROWSER_RESTRICTION');
        }
      }

      if (policies.allowed_devices && policies.allowed_devices.length > 0) {
        const mappedDevice = deviceType === 'desktop' || deviceType === 'Desktop' ? 'Desktop' : (deviceType === 'mobile' || deviceType === 'Mobile' ? 'Mobile' : deviceType);
        if (!policies.allowed_devices.includes(mappedDevice) && !policies.allowed_devices.includes(deviceType)) {
          throw new Error('POLICY_VIOLATION: DEVICE_RESTRICTION');
        }
      }
    }

    // 3. Verify password
    const isPasswordValid = await verifyPassword(password, user.password_hash);
    if (!isPasswordValid) {
      const failedAttempts = (userSecurity.failed_login_attempts || 0) + 1;
      let updateQuery = 'UPDATE user_security SET failed_login_attempts = $1 WHERE user_id = $2';
      let params = [failedAttempts, user.id];
      
      if (failedAttempts >= 5) {
        updateQuery = 'UPDATE user_security SET failed_login_attempts = $1, lockout_until = NOW() + INTERVAL \'15 minutes\' WHERE user_id = $2';
      }
      await pool.query(updateQuery, params);
      throw new Error('INVALID_CREDENTIALS');
    }

    // Reset failed attempts on success
    await pool.query('UPDATE user_security SET failed_login_attempts = 0, lockout_until = NULL WHERE user_id = $1', [user.id]);

    // 4. Password Expiry Check
    if (securitySettings.password_expiry_days > 0) {
      const lastChange = userSecurity.last_password_change ? new Date(userSecurity.last_password_change) : new Date(user.created_at);
      const diffDays = (Date.now() - lastChange.getTime()) / (1000 * 3600 * 24);
      if (diffDays > securitySettings.password_expiry_days) {
        return { passwordExpired: true, userId: user.id };
      }
    }

    // 5. Check Trusted Device & MFA
    let isTrusted = false;
    if (trustedDeviceToken) {
      const tokenHash = crypto.createHash('sha256').update(trustedDeviceToken).digest('hex');
      const trustedRes = await pool.query(
        'SELECT id FROM user_trusted_devices WHERE user_id = $1 AND device_fingerprint = $2 AND (expires_at IS NULL OR expires_at > NOW())',
        [user.id, tokenHash]
      );
      if (trustedRes.rowCount > 0) {
        isTrusted = true;
        await pool.query('UPDATE user_trusted_devices SET last_used_at = NOW() WHERE id = $1', [trustedRes.rows[0].id]);
      }
    }

    const mfaRequired = securitySettings.mfa_required_all || userSecurity.mfa_enabled || !isTrusted;

    // Fetch role name and permissions
    let roleName = user.role_name;
    let rolePermissions = [];
    let enabledModules = [];
    if (user.role_id) {
      const p = typeof user.role_permissions === 'string' ? JSON.parse(user.role_permissions) : (user.role_permissions || []);
      rolePermissions = Array.isArray(p) ? p : (p.actions || []);
      enabledModules = Array.isArray(p) ? [] : (p.modules || []);
      user.role = {
        id: user.role_id,
        name: roleName,
        permissions: rolePermissions,
        enabled_modules: enabledModules
      };
    }

    if (mfaRequired && !isTrusted) {
      const tempToken = require('jsonwebtoken').sign(
        { userId: user.id, tenantId, role: roleName, permissions: rolePermissions, email: user.email, isMfaTemp: true },
        process.env.JWT_SECRET || 'fallback_secret',
        { expiresIn: '15m' }
      );
      
      // If TOTP not setup, send Email OTP
      if (!userSecurity.mfa_enabled || userSecurity.mfa_method === 'email') {
        const otpCode = Math.floor(100000 + Math.random() * 900000).toString();
        const otpHash = crypto.createHash('sha256').update(otpCode).digest('hex');
        await pool.query(
          'INSERT INTO otp_codes (user_id, code_hash, purpose, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL \'15 minutes\')',
          [user.id, otpHash, 'login']
        );
        queueEmail(tenantId, user.id, user.email, 'Your Verification Code', 'security_alerts', { 
            name: user.name, 
            message: `Your login verification code is: ${otpCode}. It expires in 15 minutes.` 
        });
      }

      await recordLoginHistory({
        tenantId, userId: user.id, sessionId: null, emailAttempted: email,
        ip, userAgent, status: 'success_mfa_pending', failureReason: null
      });

      return { mfaRequired: true, tempToken, mfaMethod: userSecurity.mfa_enabled ? userSecurity.mfa_method : 'email' };
    }

    // 6. Concurrent Login Limits
    if (securitySettings.concurrent_login_limit > 0) {
      const activeSessionsRes = await pool.query(
        'SELECT id FROM sessions WHERE user_id = $1 ORDER BY last_active_at ASC',
        [user.id]
      );
      if (activeSessionsRes.rowCount >= securitySettings.concurrent_login_limit) {
        // Revoke oldest session
        const excess = activeSessionsRes.rowCount - securitySettings.concurrent_login_limit + 1;
        for (let i = 0; i < excess; i++) {
          const oldSessionId = activeSessionsRes.rows[i].id;
          await pool.query('UPDATE login_history SET logout_time = NOW() WHERE session_id = $1', [oldSessionId]);
          await pool.query('DELETE FROM sessions WHERE id = $1', [oldSessionId]);
        }
      }
    }

    const payload = { userId: user.id, tenantId, role: roleName, permissions: rolePermissions, email: user.email };
    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const insertSessionQuery = `
      INSERT INTO sessions (user_id, tenant_id, token_hash, expires_at, ip_address, user_agent)
      VALUES ($1, $2, $3, NOW() + INTERVAL '7 days', $4, $5)
      RETURNING id
    `;
    const sessionResult = await pool.query(insertSessionQuery, [user.id, tenantId, tokenHash, ip, userAgent]);
    const sessionId = sessionResult.rows[0].id;

    await recordLoginHistory({ tenantId, userId: user.id, sessionId, emailAttempted: email, ip, userAgent, status: 'success', failureReason: null });

    // 7. Check for First Login & Security Alerts
    const { rows: sessionCountRows } = await pool.query('SELECT COUNT(id) as count FROM sessions WHERE user_id = $1', [user.id]);
    const sessionCount = parseInt(sessionCountRows[0].count, 10);
    
    if (sessionCount === 1) { 
      queueEmail(tenantId, user.id, user.email, 'First Login Alert', 'first_login', { name: user.name });
    }

    await logAction({ tenantId, userId: user.id, action: 'user.login', entity: 'user', entityId: user.id, ip });

    delete user.password_hash;
    return { accessToken, refreshToken, user };
  } catch (err) {
    await recordLoginHistory({
      tenantId, userId: user ? user.id : null, sessionId: null, emailAttempted: email,
      ip, userAgent, status: 'failure', failureReason: err.message
    });
    throw err;
  }
}

module.exports = { loginUser, recordLoginHistory };
