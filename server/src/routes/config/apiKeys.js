const logger = require('../../utils/logger');
const express = require('express');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { generateKey, revokeKey } = require('../../services/apiKey/apiKeyService');
const pool = require('../../config/db');
const router = express.Router();

// All routes require authentication and config:manage permission
router.use(authenticate);
router.use(authorize('config:manage'));

/**
 * GET /api/config/api-keys
 * List all API keys for the tenant. Never returns key_hash.
 */
router.get('/', async (req, res, next) => {
  try {
    const query = `
      SELECT id, name, key_prefix, scopes, rate_limit_rpm, ip_allowlist, 
             expires_at, last_used_at, last_used_ip, is_active, created_at, created_by 
      FROM api_keys 
      WHERE tenant_id = $1 
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [req.tenantId]);
    res.json({ success: true, data: result.rows });
  } catch (error) {
    logger.error('Error fetching API keys:', error);
    return next(error);
  }
});

/**
 * POST /api/config/api-keys
 * Generate a new API key.
 */
router.post('/', async (req, res, next) => {
  try {
    const { name, scopes, rateLimitRpm, ipAllowlist, expiresAt } = req.body;
    
    if (!name) {
      return res.status(400).json({ success: false, error: 'Name is required' });
    }

    const { rawKey, record } = await generateKey(req.tenantId, {
      name,
      scopes,
      rateLimitRpm,
      ipAllowlist,
      expiresAt,
      createdBy: req.user.userId
    });

    // Remove sensitive key_hash from the response record
    delete record.key_hash;

    res.status(201).json({
      success: true,
      message: 'Save this key now. It will not be shown again.',
      data: {
        record,
        rawKey
      }
    });
  } catch (error) {
    logger.error('Error generating API key:', error);
    return next(error);
  }
});

/**
 * DELETE /api/config/api-keys/:id
 * Revoke an API key.
 */
router.delete('/:id', async (req, res, next) => {
  try {
    const { id } = req.params;
    const revoked = await revokeKey(req.tenantId, id);
    
    if (!revoked) {
      return res.status(404).json({ success: false, error: 'API key not found or already revoked' });
    }

    res.status(204).send();
  } catch (error) {
    logger.error('Error revoking API key:', error);
    return next(error);
  }
});

module.exports = router;
