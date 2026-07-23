const express = require('express');
const pool = require('../config/db');
const authorize = require('../middleware/authorize');
const { success, fail } = require('../utils/response');
const crypto = require('crypto');
const { queueEmail } = require('../services/emailService');
const auditLog = require('../services/auditLog');

const router = express.Router();

// Utility for creating multiple users
router.post('/import-preview', authorize('users:manage'), async (req, res, next) => {
  const tenantId = req.tenantId;
  const { users } = req.body;
  if (!Array.isArray(users)) return fail(res, 'BAD_REQUEST', 'Invalid users array', 400);

  try {
    const validRows = [];
    const invalidRows = [];
    
    const { rows: existingUsers } = await pool.query('SELECT email FROM users WHERE tenant_id = $1', [tenantId]);
    const existingEmails = new Set(existingUsers.map(u => u.email.toLowerCase()));
    const seenEmails = new Set();

    users.forEach((u, index) => {
      const email = typeof u.email === 'string' ? u.email.trim().toLowerCase() : '';
      const name = typeof u.name === 'string' ? u.name.trim() : '';
      
      let error = null;
      if (!name) error = 'Missing required field: Name';
      else if (!email) error = 'Missing required field: Email';
      else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) error = 'Invalid email format';
      else if (existingEmails.has(email)) error = 'Email already exists in system';
      else if (seenEmails.has(email)) error = 'Duplicate email within import file';

      if (email) seenEmails.add(email);

      if (error) {
        invalidRows.push({ rowIndex: index, rowData: u, error });
      } else {
        validRows.push({ rowIndex: index, rowData: { ...u, email, name } });
      }
    });

    return success(res, { validRows, invalidRows });
  } catch (err) {
    next(err);
  }
});

router.post('/import', authorize('users:manage'), async (req, res, next) => {
  const tenantId = req.tenantId;
  const { users } = req.body; // Array of { name, email, role_id, department_id, manager_id }
  
  if (!Array.isArray(users) || users.length === 0) {
    return fail(res, 'BAD_REQUEST', 'Invalid users array', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    const createdUsers = [];
    const errors = [];

    for (let i = 0; i < users.length; i++) {
      const u = users[i];
      if (!u.email || !u.name) {
        throw new Error(`Row ${i + 1}: Missing name or email`);
      }
      
      const checkRes = await client.query('SELECT id FROM users WHERE tenant_id = $1 AND email = $2', [tenantId, u.email]);
      if (checkRes.rowCount > 0) {
        throw new Error(`Row ${i + 1}: Email ${u.email} already exists`);
      }

      const tempPassword = crypto.randomBytes(8).toString('hex') + '!A';
      
      const insertRes = await client.query(`
        INSERT INTO users (tenant_id, name, email, role_id, department_id, manager_id, status)
        VALUES ($1, $2, $3, $4, $5, $6, 'active')
        RETURNING id, name, email, role_id
      `, [
        tenantId, u.name, u.email, 
        u.role_id || null, 
        u.department_id || null, 
        u.manager_id || null
      ]);
      
      const newUser = insertRes.rows[0];
      createdUsers.push(newUser);
      
      // We do not await email sending to speed up bulk imports
      const setupUrl = `http://localhost:5173/set-password?token=${tempPassword}`;
      queueEmail(tenantId, newUser.id, newUser.email, 'Welcome to CRM', 'create_password', { 
        name: newUser.name, email: newUser.email, setupUrl 
      });

      auditLog.logAction({
        tenantId, userId: req.user.userId, action: 'user.bulk_imported', entity: 'user', entityId: newUser.id,
        newValue: { email: newUser.email }
      });
    }

    await client.query('COMMIT');
    return success(res, { created: createdUsers.length, errors, details: createdUsers });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.patch('/update', authorize('users:manage'), async (req, res, next) => {
  const tenantId = req.tenantId;
  const { userIds, updates } = req.body; // updates: { role_id, department_id, manager_id, status }
  
  if (!Array.isArray(userIds) || userIds.length === 0) {
    return fail(res, 'BAD_REQUEST', 'No users selected', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    // 1. Get old states for Undo feature
    const oldStatesRes = await client.query(`
      SELECT id, role_id, department_id, manager_id, status
      FROM users WHERE tenant_id = $1 AND id = ANY($2::uuid[])
    `, [tenantId, userIds]);
    
    const oldStates = oldStatesRes.rows;
    
    // 2. Build dynamic update query
    const setClauses = [];
    const values = [tenantId, userIds];
    let vIdx = 3;
    
    if (updates.role_id !== undefined) {
      setClauses.push(`role_id = $${vIdx++}`);
      values.push(updates.role_id);
    }
    if (updates.department_id !== undefined) {
      setClauses.push(`department_id = $${vIdx++}`);
      values.push(updates.department_id);
    }
    if (updates.manager_id !== undefined) {
      setClauses.push(`manager_id = $${vIdx++}`);
      values.push(updates.manager_id);
    }
    if (updates.status !== undefined) {
      setClauses.push(`status = $${vIdx++}`);
      values.push(updates.status);
    }

    if (setClauses.length > 0) {
      setClauses.push(`updated_at = CURRENT_TIMESTAMP`);
      const updateQuery = `
        UPDATE users SET ${setClauses.join(', ')}
        WHERE tenant_id = $1 AND id = ANY($2::uuid[])
      `;
      await client.query(updateQuery, values);
    }
    
    // 3. Log audit
    auditLog.logAction({
      tenantId, userId: req.user.userId, action: 'user.bulk_updated', entity: 'user', 
      newValue: { count: userIds.length, updates }
    });

    await client.query('COMMIT');
    return success(res, { message: 'Bulk update successful', oldStates });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.post('/revert', authorize('users:manage'), async (req, res, next) => {
  const tenantId = req.tenantId;
  const { oldStates } = req.body; // Array of {id, role_id, ...}
  
  if (!Array.isArray(oldStates) || oldStates.length === 0) {
    return fail(res, 'BAD_REQUEST', 'No states to revert', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');
    
    for (const state of oldStates) {
      await client.query(`
        UPDATE users 
        SET role_id = $1, department_id = $2, manager_id = $3, status = $4, updated_at = CURRENT_TIMESTAMP
        WHERE tenant_id = $5 AND id = $6
      `, [state.role_id, state.department_id, state.manager_id, state.status, tenantId, state.id]);
    }
    
    auditLog.logAction({
      tenantId, userId: req.user.userId, action: 'user.bulk_reverted', entity: 'user', 
      newValue: { count: oldStates.length }
    });

    await client.query('COMMIT');
    return success(res, { message: 'Revert successful' });
  } catch (err) {
    await client.query('ROLLBACK');
    next(err);
  } finally {
    client.release();
  }
});

router.post('/reset-password', authorize('users:manage'), async (req, res, next) => {
  const tenantId = req.tenantId;
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) return fail(res, 'BAD_REQUEST', 'No users selected', 400);
  
  try {
    const { rows } = await pool.query('SELECT id, email, name FROM users WHERE tenant_id = $1 AND id = ANY($2::uuid[])', [tenantId, userIds]);
    
    for (const u of rows) {
      const resetToken = crypto.randomBytes(32).toString('hex');
      await pool.query(
        `INSERT INTO password_resets (tenant_id, user_id, token, expires_at) VALUES ($1, $2, $3, NOW() + INTERVAL '1 hour')`,
        [tenantId, u.id, resetToken]
      );
      const resetUrl = `http://localhost:5173/reset-password?token=${resetToken}`;
      queueEmail(tenantId, u.id, u.email, 'Password Reset', 'reset_password', { name: u.name, resetUrl });
    }
    
    auditLog.logAction({ tenantId, userId: req.user.userId, action: 'user.bulk_password_reset', entity: 'user', newValue: { count: rows.length } });
    return success(res, { message: 'Password reset emails queued' });
  } catch (err) {
    next(err);
  }
});

router.delete('/delete', authorize('users:manage'), async (req, res, next) => {
  const tenantId = req.tenantId;
  const { userIds } = req.body;
  if (!Array.isArray(userIds) || userIds.length === 0) return fail(res, 'BAD_REQUEST', 'No users selected', 400);

  try {
    // Soft delete
    const { rowCount } = await pool.query(`UPDATE users SET status = 'deleted', updated_at = CURRENT_TIMESTAMP WHERE tenant_id = $1 AND id = ANY($2::uuid[])`, [tenantId, userIds]);
    
    auditLog.logAction({ tenantId, userId: req.user.userId, action: 'user.bulk_deleted', entity: 'user', newValue: { count: rowCount } });
    return success(res, { message: `${rowCount} users deleted` });
  } catch (err) {
    next(err);
  }
});

router.post('/export', authorize('users:manage'), async (req, res, next) => {
  const tenantId = req.tenantId;
  const { userIds } = req.body; // Can be empty to export all
  
  try {
    let query = `
      SELECT u.id, u.name, u.email, r.name as role_name, u.status, d.name as department_name, m.name as manager_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN departments d ON u.department_id = d.id
      LEFT JOIN users m ON u.manager_id = m.id
      WHERE u.tenant_id = $1
    `;
    const params = [tenantId];
    if (Array.isArray(userIds) && userIds.length > 0) {
      query += ` AND u.id = ANY($2::uuid[])`;
      params.push(userIds);
    }
    
    const { rows } = await pool.query(query, params);
    
    const headers = ['ID', 'Name', 'Email', 'Role', 'Status', 'Department', 'Manager'];
    let csvString = headers.map(h => `"${h}"`).join(',') + '\n';
    
    for (const row of rows) {
      csvString += `"${row.id}","${row.name}","${row.email}","${row.role_name || ''}","${row.status}","${row.department_name || ''}","${row.manager_name || ''}"\n`;
    }
    
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', 'attachment; filename="users-export.csv"');
    return res.send(csvString);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
