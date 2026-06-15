const { validateKey } = require('../services/apiKey/apiKeyService');

/**
 * Express middleware to authenticate requests using an X-API-Key header.
 */
async function authenticateApiKey(req, res, next) {
  const rawKey = req.header('X-API-Key');
  if (!rawKey) {
    return res.status(401).json({ success: false, error: 'UNAUTHORIZED', message: 'Missing X-API-Key header' });
  }

  try {
    // 1. Validate key and update last_used
    const apiKeyRecord = await validateKey(rawKey, req.ip);

    // 2. Check IP allowlist
    let allowlist = apiKeyRecord.ip_allowlist;
    if (typeof allowlist === 'string') {
      try {
        allowlist = JSON.parse(allowlist);
      } catch (e) {
        allowlist = [];
      }
    }
    if (Array.isArray(allowlist) && allowlist.length > 0) {
      if (!allowlist.includes(req.ip)) {
        return res.status(403).json({ success: false, error: 'IP_NOT_ALLOWED', message: 'IP address not allowed for this API key' });
      }
    }

    // 3. Set request context
    req.tenantId = apiKeyRecord.tenant_id;
    req.apiKey = apiKeyRecord;
    
    // Parse scopes
    let scopes = apiKeyRecord.scopes || [];
    if (typeof scopes === 'string') {
      try {
        scopes = JSON.parse(scopes);
      } catch (e) {
        scopes = ['read'];
      }
    }

    req.user = { 
      userId: null, 
      role: 'api', 
      permissions: scopes 
    };

    // 4. Pass to next middleware
    next();
  } catch (err) {
    if (err.code === 'INVALID_API_KEY' || err.code === 'API_KEY_EXPIRED') {
      return res.status(401).json({ success: false, error: err.code });
    }
    console.error('API Key Auth Error:', err);
    return res.status(500).json({ success: false, error: 'INTERNAL_ERROR', message: 'Authentication failed' });
  }
}

module.exports = authenticateApiKey;
