const crypto = require('crypto');
const pool = require('../db/pool');

function hashApiKey(apiKey) {
  return crypto.createHash('sha256').update(apiKey).digest('hex');
}

/**
 * Middleware to authenticate requests via API Key and authorize based on required permission.
 * @param {string} requiredPermission - The permission required to access the endpoint (e.g. 'Leads Read').
 */
const apiAuth = (requiredPermission) => {
  return async (req, res, next) => {
    try {
      const authHeader = req.header('Authorization');
      if (!authHeader || !authHeader.startsWith('Bearer ')) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Missing or invalid Authorization header. Expected "Bearer <API_KEY>"' });
      }

      const apiKey = authHeader.replace('Bearer ', '').trim();
      const hashedKey = hashApiKey(apiKey);

      const result = await pool.query(
        `SELECT id, tenant_id, status, permissions FROM api_keys WHERE secret_hash = $1 LIMIT 1`,
        [hashedKey]
      );

      const keyData = result.rows[0];

      if (!keyData) {
        return res.status(401).json({ success: false, error: 'Unauthorized: Invalid API Key' });
      }

      if (keyData.status !== 'active') {
        return res.status(403).json({ success: false, error: 'Forbidden: API Key is inactive' });
      }

      // If a specific permission is required, check it
      if (requiredPermission) {
        const permissions = typeof keyData.permissions === 'string' ? JSON.parse(keyData.permissions) : (keyData.permissions || []);
        if (!permissions.includes(requiredPermission)) {
          return res.status(403).json({ success: false, error: `Forbidden: Missing required permission '${requiredPermission}'` });
        }
      }

      // Attach context to request
      req.tenantId = keyData.tenant_id;
      req.apiKeyId = keyData.id;

      // Update last_used_at asynchronously
      pool.query(`UPDATE api_keys SET last_used_at = CURRENT_TIMESTAMP WHERE id = $1`, [keyData.id]).catch(console.error);

      next();
    } catch (error) {
      console.error('API Auth Error:', error);
      res.status(500).json({ success: false, error: 'Internal Server Error' });
    }
  };
};

module.exports = {
  apiAuth,
  hashApiKey
};
