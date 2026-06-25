const express = require('express');
const pool = require('../../db/pool');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { success, fail } = require('../../utils/response');

const router = express.Router();

router.use(authenticate);

// GET /api/config/tenant-settings
router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    const result = await pool.query('SELECT config FROM tenants WHERE id = $1', [tenantId]);
    if (result.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Tenant not found', 404);
    }

    const configStr = result.rows[0].config;
    const config = typeof configStr === 'string' ? JSON.parse(configStr || '{}') : (configStr || {});
    return success(res, config);
  } catch (error) {
    next(error);
  }
});

// PATCH /api/config/tenant-settings
router.patch('/', authorize('config:manage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    // Get current config
    const result = await pool.query('SELECT config FROM tenants WHERE id = $1', [tenantId]);
    if (result.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Tenant not found', 404);
    }

    const configStr = result.rows[0].config;
    const currentConfig = typeof configStr === 'string' ? JSON.parse(configStr || '{}') : (configStr || {});

    // Merge new config
    const updatedConfig = {
      ...currentConfig,
      ...req.body
    };

    // Save back to db
    await pool.query(
      'UPDATE tenants SET config = $1, updated_at = NOW() WHERE id = $2',
      [JSON.stringify(updatedConfig), tenantId]
    );

    return success(res, updatedConfig);
  } catch (error) {
    next(error);
  }
});

module.exports = router;
