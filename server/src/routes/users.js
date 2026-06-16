const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { success, fail } = require('../utils/response');
const pool = require('../config/db');
const crypto = require('crypto');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  const tenantId = req.tenantId;
  const { search, role, status, page, limit } = req.query;

  try {
    let query = `
      SELECT u.*, r.name as role_name, r.permissions
      FROM users u LEFT JOIN roles r ON r.id=u.role_id
      WHERE u.tenant_id=$1 AND u.deleted_at IS NULL
    `;
    const params = [tenantId];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length})`;
    }

    if (role) {
      params.push(role);
      query += ` AND r.name = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND u.status = $${params.length}`;
    }

    query += ` ORDER BY u.created_at DESC`;

    // Implement pagination if needed, or just return all based on the instruction
    if (limit) {
      params.push(parseInt(limit, 10));
      query += ` LIMIT $${params.length}`;
    }
    if (page && limit) {
      params.push((parseInt(page, 10) - 1) * parseInt(limit, 10));
      query += ` OFFSET $${params.length}`;
    }

    const { rows } = await pool.query(query, params);
    
    // Remove password hashes from response
    const safeUsers = rows.map(u => {
      const { password_hash, ...rest } = u;
      return rest;
    });

    res.json(success(safeUsers));
  } catch (error) {
    res.status(500).json(fail('Users fetch failed'));
  }
});

router.patch('/:id', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const userIdToUpdate = req.params.id;
  const { name, roleId, status, avatar_url } = req.body;

  try {
    const updates = [];
    const params = [userIdToUpdate, tenantId];

    if (name) {
      params.push(name);
      updates.push(`name = $${params.length}`);
    }
    if (roleId) {
      params.push(roleId);
      updates.push(`role_id = $${params.length}`);
    }
    if (status) {
      params.push(status);
      updates.push(`status = $${params.length}`);
    }
    if (avatar_url !== undefined) {
      params.push(avatar_url);
      updates.push(`avatar_url = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json(fail('No fields to update'));
    }

    updates.push('updated_at = NOW()');

    const { rows } = await pool.query(`
      UPDATE users SET ${updates.join(', ')}
      WHERE id=$1 AND tenant_id=$2
      RETURNING *
    `, params);

    if (rows.length === 0) return res.status(404).json(fail('User not found'));

    const { password_hash, ...safeUser } = rows[0];
    res.json(success(safeUser));
  } catch (error) {
    res.status(500).json(fail('User update failed'));
  }
});

router.post('/invite', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const { name, email, roleId } = req.body;

  try {
    const checkRes = await pool.query(`SELECT id FROM users WHERE email=$1 AND tenant_id=$2`, [email, tenantId]);
    if (checkRes.rows.length > 0) {
      return res.status(400).json(fail('Email already registered in this tenant'));
    }

    const tempPasswordHash = crypto.randomBytes(16).toString('hex'); // STUB hash

    const { rows } = await pool.query(`
      INSERT INTO users (tenant_id, name, email, role_id, status, password_hash)
      VALUES ($1, $2, $3, $4, 'invited', $5)
      RETURNING *
    `, [tenantId, name, email, roleId, tempPasswordHash]);

    console.log(`Invitation email would be sent to ${email}`);

    const { password_hash, ...safeUser } = rows[0];
    res.json(success(safeUser));
  } catch (error) {
    res.status(500).json(fail('User invite failed'));
  }
});

module.exports = router;
