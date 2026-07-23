const express = require('express');
const pool = require('../config/db');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { success, fail } = require('../utils/response');
const { logAction } = require('../services/auditLog');

const router = express.Router();
router.use(authenticate);

// Helpers
const checkCircularReference = async (tenantId, userId, newManagerId) => {
  if (userId === newManagerId) return true; // Direct circular

  // Recursive query to check if the new manager reports to the current user anywhere up the chain
  const query = `
    WITH RECURSIVE org_tree AS (
      SELECT id, manager_id
      FROM users
      WHERE id = $1 AND tenant_id = $2
      
      UNION ALL
      
      SELECT u.id, u.manager_id
      FROM users u
      INNER JOIN org_tree ot ON u.id = ot.manager_id
      WHERE u.tenant_id = $2
    )
    SELECT id FROM org_tree WHERE id = $3;
  `;
  
  const { rows } = await pool.query(query, [newManagerId, tenantId, userId]);
  return rows.length > 0; // If userId is found in the new manager's chain, it's circular
};

// ----------------------------------------------------------------------
// Users & Manager
// ----------------------------------------------------------------------

// Get full user hierarchy
router.get('/hierarchy', async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const { rows } = await pool.query(`
      SELECT u.id, u.name, u.email, u.avatar_url, u.status, u.manager_id, u.department_id, u.branch_id, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.tenant_id = $1 AND u.deleted_at IS NULL
    `, [tenantId]);
    return success(res, rows);
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch hierarchy', 500);
  }
});

// Update user manager, department, or branch
router.patch('/users/:id', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.params.id;
  const { manager_id, department_id, branch_id } = req.body;

  try {
    if (manager_id) {
      const isCircular = await checkCircularReference(tenantId, userId, manager_id);
      if (isCircular) {
        return fail(res, 'VALIDATION_ERROR', 'Circular reporting detected. This change would create an infinite loop.', 400);
      }
    }

    const updates = [];
    const params = [userId, tenantId];

    if (manager_id !== undefined) {
      params.push(manager_id);
      updates.push(`manager_id = $${params.length}`);
    }
    if (department_id !== undefined) {
      params.push(department_id);
      updates.push(`department_id = $${params.length}`);
    }
    if (branch_id !== undefined) {
      params.push(branch_id);
      updates.push(`branch_id = $${params.length}`);
    }

    if (updates.length === 0) return fail(res, 'VALIDATION_ERROR', 'No fields to update', 400);
    
    updates.push('updated_at = NOW()');

    const { rows } = await pool.query(`
      UPDATE users SET ${updates.join(', ')} 
      WHERE id = $1 AND tenant_id = $2 
      RETURNING id, name, manager_id, department_id, branch_id
    `, params);

    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'User not found', 404);

    logAction({ tenantId, userId: req.user.userId, action: 'org.user_updated', entity: 'user', entityId: userId });
    return success(res, rows[0]);
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to update user organization data', 500);
  }
});

// Batch Assign Users to Department or Branch
router.patch('/users/batch-assign', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const { user_ids, department_id, branch_id } = req.body;

  if (!user_ids || !Array.isArray(user_ids) || user_ids.length === 0) {
    return fail(res, 'VALIDATION_ERROR', 'user_ids array is required', 400);
  }
  if (department_id === undefined && branch_id === undefined) {
    return fail(res, 'VALIDATION_ERROR', 'Must provide department_id or branch_id', 400);
  }

  try {
    const updates = [];
    const params = [user_ids, tenantId];
    
    if (department_id !== undefined) {
      params.push(department_id);
      updates.push(`department_id = $${params.length}`);
    }
    if (branch_id !== undefined) {
      params.push(branch_id);
      updates.push(`branch_id = $${params.length}`);
    }

    updates.push('updated_at = NOW()');

    await pool.query(`
      UPDATE users SET ${updates.join(', ')} 
      WHERE id = ANY($1::uuid[]) AND tenant_id = $2
    `, params);

    logAction({ tenantId, userId: req.user.userId, action: 'org.users_batch_assigned', entity: 'user', details: JSON.stringify({ user_ids, department_id, branch_id }) });
    return success(res, { message: 'Users assigned successfully' });
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to batch assign users', 500);
  }
});

// ----------------------------------------------------------------------
// Departments
// ----------------------------------------------------------------------

router.get('/departments', async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const { rows } = await pool.query(`
      SELECT 
        d.*, 
        u.name as manager_name,
        u.avatar_url as manager_avatar,
        (SELECT COUNT(*) FROM users WHERE department_id = d.id AND deleted_at IS NULL)::int as employee_count
      FROM departments d
      LEFT JOIN users u ON u.id = d.manager_id
      WHERE d.tenant_id = $1 
      ORDER BY d.created_at ASC
    `, [tenantId]);
    return success(res, rows);
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch departments', 500);
  }
});

router.post('/departments', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const { name, parent_id, code, description, manager_id } = req.body;
  
  if (!name) return fail(res, 'VALIDATION_ERROR', 'Name is required', 400);

  try {
    const { rows } = await pool.query(`
      INSERT INTO departments (tenant_id, name, parent_id, code, description, manager_id) 
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [tenantId, name, parent_id || null, code || null, description || null, manager_id || null]);
    
    logAction({ tenantId, userId: req.user.userId, action: 'org.department_created', entity: 'department', entityId: rows[0].id });
    return success(res, rows[0]);
  } catch (error) {
    if (error.code === '23505') return fail(res, 'VALIDATION_ERROR', 'Department name already exists', 400);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create department', 500);
  }
});

router.patch('/departments/:id', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id;
  const { name, parent_id, code, description, manager_id } = req.body;

  try {
    if (parent_id === id) return fail(res, 'VALIDATION_ERROR', 'Cannot set parent to self', 400);

    if (parent_id) {
      const { rows: tree } = await pool.query(`
        WITH RECURSIVE check_tree AS (
          SELECT id, parent_id FROM ${req.route.path.includes('departments') ? 'departments' : 'branches'} WHERE id = $1
          UNION ALL
          SELECT t.id, t.parent_id FROM ${req.route.path.includes('departments') ? 'departments' : 'branches'} t
          INNER JOIN check_tree ct ON ct.parent_id = t.id
        )
        SELECT id FROM check_tree
      `, [parent_id]);
      if (tree.some(node => node.id === id)) return fail(res, 'VALIDATION_ERROR', 'Circular structure detected', 400);
    }

    const updates = [];
    const params = [id, tenantId];

    if (name !== undefined) { params.push(name); updates.push(`name = $${params.length}`); }
    if (parent_id !== undefined) { params.push(parent_id); updates.push(`parent_id = $${params.length}`); }
    if (code !== undefined) { params.push(code); updates.push(`code = $${params.length}`); }
    if (description !== undefined) { params.push(description); updates.push(`description = $${params.length}`); }
    if (manager_id !== undefined) { params.push(manager_id); updates.push(`manager_id = $${params.length}`); }

    if (updates.length === 0) return fail(res, 'VALIDATION_ERROR', 'No fields to update', 400);
    updates.push('updated_at = NOW()');

    const { rows } = await pool.query(`
      UPDATE departments SET ${updates.join(', ')} 
      WHERE id = $1 AND tenant_id = $2 RETURNING *
    `, params);

    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Department not found', 404);
    
    logAction({ tenantId, userId: req.user.userId, action: 'org.department_updated', entity: 'department', entityId: id });
    return success(res, rows[0]);
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to update department', 500);
  }
});

router.delete('/departments/:id', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id;
  try {
    const { rowCount } = await pool.query(`DELETE FROM departments WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    if (rowCount === 0) return fail(res, 'NOT_FOUND', 'Department not found', 404);
    logAction({ tenantId, userId: req.user.userId, action: 'org.department_deleted', entity: 'department', entityId: id });
    return success(res, { message: 'Deleted' });
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete department', 500);
  }
});

// ----------------------------------------------------------------------
// Branches
// ----------------------------------------------------------------------

router.get('/branches', async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const { rows } = await pool.query(`
      SELECT 
        b.*,
        u.name as manager_name,
        u.avatar_url as manager_avatar,
        (SELECT COUNT(*) FROM users WHERE branch_id = b.id AND deleted_at IS NULL)::int as employee_count
      FROM branches b
      LEFT JOIN users u ON u.id = b.manager_id
      WHERE b.tenant_id = $1 
      ORDER BY b.created_at ASC
    `, [tenantId]);
    return success(res, rows);
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch branches', 500);
  }
});

router.post('/branches', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const { name, parent_id, location, timezone, manager_id } = req.body;
  
  if (!name) return fail(res, 'VALIDATION_ERROR', 'Name is required', 400);

  try {
    const { rows } = await pool.query(`
      INSERT INTO branches (tenant_id, name, parent_id, location, timezone, manager_id) 
      VALUES ($1, $2, $3, $4, $5, $6) RETURNING *
    `, [tenantId, name, parent_id || null, location || null, timezone || null, manager_id || null]);
    
    logAction({ tenantId, userId: req.user.userId, action: 'org.branch_created', entity: 'branch', entityId: rows[0].id });
    return success(res, rows[0]);
  } catch (error) {
    if (error.code === '23505') return fail(res, 'VALIDATION_ERROR', 'Branch name already exists', 400);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create branch', 500);
  }
});

router.patch('/branches/:id', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id;
  const { name, parent_id, location, timezone, manager_id } = req.body;

  try {
    if (parent_id === id) return fail(res, 'VALIDATION_ERROR', 'Cannot set parent to self', 400);

    if (parent_id) {
      const { rows: tree } = await pool.query(`
        WITH RECURSIVE check_tree AS (
          SELECT id, parent_id FROM ${req.route.path.includes('departments') ? 'departments' : 'branches'} WHERE id = $1
          UNION ALL
          SELECT t.id, t.parent_id FROM ${req.route.path.includes('departments') ? 'departments' : 'branches'} t
          INNER JOIN check_tree ct ON ct.parent_id = t.id
        )
        SELECT id FROM check_tree
      `, [parent_id]);
      if (tree.some(node => node.id === id)) return fail(res, 'VALIDATION_ERROR', 'Circular structure detected', 400);
    }

    const updates = [];
    const params = [id, tenantId];

    if (name !== undefined) { params.push(name); updates.push(`name = $${params.length}`); }
    if (parent_id !== undefined) { params.push(parent_id); updates.push(`parent_id = $${params.length}`); }
    if (location !== undefined) { params.push(location); updates.push(`location = $${params.length}`); }
    if (timezone !== undefined) { params.push(timezone); updates.push(`timezone = $${params.length}`); }
    if (manager_id !== undefined) { params.push(manager_id); updates.push(`manager_id = $${params.length}`); }

    if (updates.length === 0) return fail(res, 'VALIDATION_ERROR', 'No fields to update', 400);
    updates.push('updated_at = NOW()');

    const { rows } = await pool.query(`
      UPDATE branches SET ${updates.join(', ')} 
      WHERE id = $1 AND tenant_id = $2 RETURNING *
    `, params);

    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Branch not found', 404);
    
    logAction({ tenantId, userId: req.user.userId, action: 'org.branch_updated', entity: 'branch', entityId: id });
    return success(res, rows[0]);
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to update branch', 500);
  }
});

router.delete('/branches/:id', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const id = req.params.id;
  try {
    const { rowCount } = await pool.query(`DELETE FROM branches WHERE id = $1 AND tenant_id = $2`, [id, tenantId]);
    if (rowCount === 0) return fail(res, 'NOT_FOUND', 'Branch not found', 404);
    logAction({ tenantId, userId: req.user.userId, action: 'org.branch_deleted', entity: 'branch', entityId: id });
    return success(res, { message: 'Deleted' });
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete branch', 500);
  }
});

module.exports = router;
