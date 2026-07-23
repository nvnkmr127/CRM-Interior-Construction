const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { success, fail } = require('../utils/response');
const pool = require('../config/db');
const { queueEmail } = require('../services/emailService');

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

// Update a role
router.patch('/:id', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const roleId = req.params.id;
  const { name, permissions } = req.body;

  try {
    const { rows: roleRows } = await pool.query('SELECT * FROM roles WHERE id=$1 AND tenant_id=$2', [roleId, tenantId]);
    if (roleRows.length === 0) return fail(res, 'NOT_FOUND', 'Role not found', 404);
    if (roleRows[0].is_system) return fail(res, 'VALIDATION_ERROR', 'Cannot modify system roles', 400);

    const permsStr = JSON.stringify(permissions || []);
    const { rows } = await pool.query(`
      UPDATE roles SET name = COALESCE($1, name), permissions = $2
      WHERE id = $3 AND tenant_id = $4
      RETURNING *
    `, [name, permsStr, roleId, tenantId]);
    
    // Notify all users in this role
    if (permissions) {
      const { rows: usersInRole } = await pool.query('SELECT id, name, email FROM users WHERE role_id=$1 AND tenant_id=$2 AND status=\'active\'', [roleId, tenantId]);
      for (const u of usersInRole) {
        queueEmail(tenantId, u.id, u.email, 'Permissions Updated', 'permission_updated', { name: u.name });
        const { logAction } = require('../services/auditLog');
        await logAction({ tenantId, userId: req.user.userId, action: 'employee.permissions_updated', entity: 'user', entityId: u.id, newValue: { role: rows[0].name } });
      }
    }

    const updatedRole = {
      ...rows[0],
      permissions: typeof rows[0].permissions === 'string' ? JSON.parse(rows[0].permissions || '[]') : (rows[0].permissions || [])
    };
    return success(res, updatedRole);
  } catch (error) {
    console.error('[Roles API] Update error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update role', 500);
  }
});

module.exports = router;
