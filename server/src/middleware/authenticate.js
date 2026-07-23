const { verifyAccessToken, TokenExpiredError } = require('../services/auth/tokens');
const authenticateApiKey = require('./authenticateApiKey');
const { getTenantPool } = require('../db/tenantResolver');
/**
 * Express middleware to authenticate API requests via JWT or API Key.
 */
async function authenticate(req, res, next) {
  try {
    // 1. Read Authorization header, X-API-Key, or cookie
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'];
    let token = req.cookies?.accessToken;

    // Route to API Key authentication if present
    if (apiKeyHeader) {
      return authenticateApiKey(req, res, next);
    }

    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      // 2. If no token -> 401 UNAUTHORIZED
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    }

    // 3. Verify the token
    const decoded = verifyAccessToken(token);

    // V4: Continuous Authentication (Zero Trust) - Ensure session still exists
    const pool = require('../db/pool'); // Get pool reference
    const { getCache, setCache } = require('../utils/cache');
    
    if (decoded.sessionId && pool) {
      const cacheKey = `session:${decoded.sessionId}`;
      let session = null;
      
      try {
        session = await getCache(cacheKey);
      } catch (err) {
        console.warn('Redis cache miss or error for session validation', err);
      }

      if (!session) {
        const sessionResult = await pool.query(
          'SELECT id, ip_address, user_agent, last_active_at FROM sessions WHERE id = $1 AND tenant_id = $2',
          [decoded.sessionId, decoded.tenantId]
        );
        if (sessionResult.rowCount === 0) {
          // Session was revoked or deleted
          return res.status(401).json({ success: false, error: 'SESSION_REVOKED', message: 'Your session has been terminated.' });
        }
        session = sessionResult.rows[0];
        
        // Cache the session data for 5 minutes (reduced from 15 to allow last_active_at updates to sync better)
        setCache(cacheKey, session, 300).catch(err => console.warn('Failed to cache session', err));
      }

      // Check session timeout from tenant settings
      const settingsCacheKey = `tenant_security:${decoded.tenantId}`;
      let securitySettings = await getCache(settingsCacheKey).catch(() => null);
      
      if (!securitySettings) {
        const settingsRes = await pool.query('SELECT session_timeout_minutes FROM tenant_security_settings WHERE tenant_id = $1', [decoded.tenantId]);
        if (settingsRes.rowCount > 0) {
          securitySettings = settingsRes.rows[0];
          setCache(settingsCacheKey, securitySettings, 3600).catch(() => {});
        } else {
          securitySettings = { session_timeout_minutes: 120 };
        }
      }

      const timeoutMinutes = securitySettings.session_timeout_minutes || 120;
      const lastActive = session.last_active_at ? new Date(session.last_active_at) : new Date();
      const diffMinutes = (Date.now() - lastActive.getTime()) / 60000;

      if (diffMinutes > timeoutMinutes) {
        // Session expired due to inactivity
        await pool.query('DELETE FROM sessions WHERE id = $1', [decoded.sessionId]);
        const { clearCache } = require('../utils/cache');
        await clearCache(cacheKey).catch(() => {});
        return res.status(401).json({ success: false, error: 'SESSION_TIMEOUT', message: 'Session expired due to inactivity.' });
      }

      // Periodically update last_active_at (e.g. if older than 5 minutes) to avoid thrashing DB
      if (diffMinutes > 5) {
        pool.query('UPDATE sessions SET last_active_at = NOW() WHERE id = $1', [decoded.sessionId]).catch(() => {});
        session.last_active_at = new Date().toISOString();
        setCache(cacheKey, session, 300).catch(() => {});
      }

      // V3: Risk-Based Authentication & Session Scoring
      const currentIp = req.ip || req.connection?.remoteAddress;
      const currentUserAgent = req.headers['user-agent'];
      
      let riskScore = 0;
      if (session.ip_address && currentIp && session.ip_address !== currentIp) {
        riskScore += 50; // High risk if IP changes mid-session
      }
      if (session.user_agent && currentUserAgent && session.user_agent !== currentUserAgent) {
        riskScore += 50; // Extremely suspicious if browser changes mid-session
      }

      // V3 Geo-Fencing Stub: In production, use geoip-lite or Cloudflare headers
      const countryCode = req.headers['cf-ipcountry'] || 'US';
      const allowedCountries = ['US', 'IN', 'GB', 'CA']; // Configurable per tenant
      if (!allowedCountries.includes(countryCode)) {
        console.warn(`[SECURITY] Blocked login attempt from unauthorized country: ${countryCode}`);
        return res.status(403).json({ success: false, error: 'GEO_BLOCKED', message: 'Access from your current location is not permitted.' });
      }

      req.riskScore = riskScore;
      if (riskScore >= 100) {
        // Force MFA or immediate re-login on high anomaly
        return res.status(403).json({ success: false, error: 'RISK_LEVEL_CRITICAL', message: 'Anomalous activity detected. Please re-authenticate.' });
      }
    }

    // 6. Set request context
    req.user = decoded;
    // Normalize user ID property
    if (!req.user.id && req.user.userId) {
      req.user.id = req.user.userId;
    }
    req.tenantId = decoded.tenantId;

    // Attach the dynamically resolved database pool
    req.dbPool = getTenantPool(req.tenantId);

    // 7. Call next middleware
    next();
  } catch (error) {
    if (error instanceof TokenExpiredError) {
      // 4. TokenExpiredError -> 401 TOKEN_EXPIRED
      return res.status(401).json({ success: false, error: 'TOKEN_EXPIRED' });
    }
    
    // 5. Any other error -> 401 TOKEN_INVALID
    return res.status(401).json({ success: false, error: 'TOKEN_INVALID' });
  }
}

module.exports = authenticate;
