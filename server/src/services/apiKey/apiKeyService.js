const crypto = require('crypto');
const pool = require('../../db/pool');

/**
 * Generate a new API key for a tenant.
 */
exports.generateKey = async (tenantId, { name, scopes = ['read'], rateLimitRpm = 60, ipAllowlist = [], expiresAt = null, createdBy = null }) => {
  // 1. Generate raw key
  const rawKey = 'crm_' + crypto.randomBytes(32).toString('hex');
  
  // 2. Prefix for display (e.g. 'crm_a1b2')
  const prefix = rawKey.substring(0, 8);
  
  // 3. Hash the key for storage
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');
  
  // 4. Insert into database
  const query = `
    INSERT INTO api_keys (
      tenant_id, name, key_hash, key_prefix, scopes, rate_limit_rpm, ip_allowlist, expires_at, created_by
    ) VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
    RETURNING *
  `;
  const values = [
    tenantId,
    name,
    keyHash,
    prefix,
    JSON.stringify(scopes),
    rateLimitRpm,
    JSON.stringify(ipAllowlist),
    expiresAt,
    createdBy
  ];

  const result = await pool.query(query, values);
  
  return {
    rawKey,
    record: result.rows[0]
  };
};

/**
 * Validate an API key and update its last used timestamp/IP.
 */
exports.validateKey = async (rawKey, ipAddress = null) => {
  // 1. Hash the incoming raw key
  const keyHash = crypto.createHash('sha256').update(rawKey).digest('hex');

  // 2. Lookup active key
  const selectQuery = `
    SELECT * FROM api_keys 
    WHERE key_hash = $1 AND is_active = true
  `;
  const result = await pool.query(selectQuery, [keyHash]);
  const apiKey = result.rows[0];

  // 3. Not found or inactive
  if (!apiKey) {
    const error = new Error('INVALID_API_KEY');
    error.code = 'INVALID_API_KEY';
    throw error;
  }

  // 4. Check expiration
  if (apiKey.expires_at && new Date() > new Date(apiKey.expires_at)) {
    const error = new Error('API_KEY_EXPIRED');
    error.code = 'API_KEY_EXPIRED';
    throw error;
  }

  // 5. Update last_used_at and last_used_ip
  const updateQuery = `
    UPDATE api_keys
    SET last_used_at = NOW(),
        last_used_ip = COALESCE($2, last_used_ip)
    WHERE id = $1
  `;
  await pool.query(updateQuery, [apiKey.id, ipAddress]);

  // 6. Return record
  return apiKey;
};

/**
 * Revoke an API key.
 */
exports.revokeKey = async (tenantId, keyId) => {
  const query = `
    UPDATE api_keys 
    SET is_active = false 
    WHERE id = $1 AND tenant_id = $2
  `;
  const result = await pool.query(query, [keyId, tenantId]);
  return result.rowCount > 0;
};
