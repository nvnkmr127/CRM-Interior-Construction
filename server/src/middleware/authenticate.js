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
    // (In production, use Redis for performance instead of Postgres on every request)
    const pool = require('../config/db'); // Get pool reference
    if (decoded.sessionId && pool) {
      const sessionResult = await pool.query(
        'SELECT ip_address, user_agent FROM sessions WHERE id = $1 AND tenant_id = $2',
        [decoded.sessionId, decoded.tenantId]
      );
      if (sessionResult.rowCount === 0) {
        // Session was revoked or deleted
        return res.status(401).json({ success: false, error: 'SESSION_REVOKED', message: 'Your session has been terminated.' });
      }

      // V3: Risk-Based Authentication & Session Scoring
      const session = sessionResult.rows[0];
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
