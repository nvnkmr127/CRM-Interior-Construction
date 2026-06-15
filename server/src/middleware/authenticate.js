const { verifyAccessToken, TokenExpiredError } = require('../services/auth/tokens');

/**
 * Express middleware to authenticate API requests via JWT or API Key.
 */
async function authenticate(req, res, next) {
  try {
    // 1. Read Authorization header or X-API-Key
    const authHeader = req.headers.authorization;
    const apiKeyHeader = req.headers['x-api-key'];

    // Stub for API Key support (real implementation in D2-35)
    if (apiKeyHeader) {
      return next(); // Just pass through for now
    }

    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      // 2. If no token -> 401 UNAUTHORIZED
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    }

    const token = authHeader.split(' ')[1];

    if (!token) {
      return res.status(401).json({ success: false, error: 'UNAUTHORIZED' });
    }

    // 3. Verify the token
    const decoded = verifyAccessToken(token);

    // 6. Set request context
    req.user = decoded;
    req.tenantId = decoded.tenantId;

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
