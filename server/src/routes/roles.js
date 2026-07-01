const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { success, fail } = require('../utils/response');
const pool = require('../config/db');

const router = express.Router();

router.use(authenticate);

// Get all roles for the tenant
router.get('/', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;

  try {
    const query = `
      SELECT id, name, permissions, is_system, created_at
      FROM roles
      WHERE tenant_id = $1
      ORDER BY name ASC
    `;
    const { rows } = await pool.query(query, [tenantId]);

    // Parse permissions from string if they are stored as JSON string
    const parsedRows = rows.map(r => ({
      ...r,
      permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions || '[]') : (r.permissions || [])
    }));

    return success(res, parsedRows);
  } catch (error) {
    console.error('[Roles API] Fetch error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch roles', 500);
  }
});

// Create a new role
router.post('/', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const { name, permissions } = req.body;

  if (!name) {
    return fail(res, 'VALIDATION_ERROR', 'Role name is required', 400);
  }

  try {
    const query = `
      INSERT INTO roles (tenant_id, name, permissions)
      VALUES ($1, $2, $3)
      RETURNING id, name, permissions, is_system, created_at
    `;
    const permsStr = JSON.stringify(permissions || []);
    const { rows } = await pool.query(query, [tenantId, name, permsStr]);

    const newRole = {
      ...rows[0],
      permissions: typeof rows[0].permissions === 'string' ? JSON.parse(rows[0].permissions || '[]') : (rows[0].permissions || [])
    };
    return success(res, newRole);
  } catch (error) {
    console.error('[Roles API] Create error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create role', 500);
  }
});

module.exports = router;
