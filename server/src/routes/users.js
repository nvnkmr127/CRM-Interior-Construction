const express = require('express');
const bcrypt = require('bcryptjs');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { success, fail } = require('../utils/response');
const pool = require('../config/db');
const crypto = require('crypto');
const { logAction } = require('../services/auditLog');
const { queueEmail } = require('../services/emailService');
const aiEmployeeService = require('../services/aiEmployeeService');

const router = express.Router();

const VALID_TRANSITIONS = {
  'pending_approval': ['active', 'probation', 'rejected', 'changes_requested'],
  'changes_requested': ['pending_approval', 'rejected'],
  'rejected': ['pending_approval', 'archived'],
  'invited': ['onboarding', 'active'],
  'onboarding': ['probation', 'active'],
  'probation': ['active', 'terminated', 'resigned'],
  'active': ['suspended', 'locked', 'inactive', 'resigned', 'terminated'],
  'suspended': ['active', 'terminated'],
  'locked': ['active', 'terminated'],
  'inactive': ['active', 'archived'],
  'resigned': ['archived'],
  'terminated': ['archived'],
  'archived': []
};

router.use(authenticate);


// AI Routes
router.get('/ai/insights', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT id, name, email, role_id, status, last_login_at as "lastActive" FROM users WHERE tenant_id=$1 AND deleted_at IS NULL', [req.tenantId]);
    
    // Attach roles if needed
    const rolesReq = await pool.query('SELECT id, name FROM roles WHERE tenant_id=$1', [req.tenantId]);
    const roleMap = {};
    rolesReq.rows.forEach(r => roleMap[r.id] = r.name);
    
    const users = rows.map(u => ({ ...u, role_name: roleMap[u.role_id] || 'Unknown' }));
    
    const insights = await aiEmployeeService.detectAnomalies(users);
    res.json(success(insights));
  } catch (error) {
    res.status(500).json(fail('Failed to fetch AI insights'));
  }
});

router.post('/ai/search', async (req, res) => {
  try {
    const { query } = req.body;
    if (!query) return res.json(success({ matchingIds: [] }));

    const { rows } = await pool.query('SELECT id, name, email, status, department_id, role_id FROM users WHERE tenant_id=$1 AND deleted_at IS NULL', [req.tenantId]);
    
    const rolesReq = await pool.query('SELECT id, name FROM roles WHERE tenant_id=$1', [req.tenantId]);
    const roleMap = {};
    rolesReq.rows.forEach(r => roleMap[r.id] = r.name);
    
    const deptReq = await pool.query('SELECT id, name FROM departments WHERE tenant_id=$1', [req.tenantId]);
    const deptMap = {};
    deptReq.rows.forEach(d => deptMap[d.id] = d.name);

    const users = rows.map(u => ({ 
      ...u, 
      role_name: roleMap[u.role_id],
      department_name: deptMap[u.department_id] 
    }));

    const result = await aiEmployeeService.naturalLanguageSearch(query, users);
    res.json(success(result));
  } catch (error) {
    res.status(500).json(fail('AI Search Failed'));
  }
});

router.get('/:id/ai/summary', async (req, res) => {
  try {
    const { rows } = await pool.query('SELECT u.*, r.name as role_name FROM users u LEFT JOIN roles r ON r.id = u.role_id WHERE u.id=$1 AND u.tenant_id=$2', [req.params.id, req.tenantId]);
    if (rows.length === 0) return res.status(404).json(fail('User not found'));
    
    const user = rows[0];
    user.lastActive = user.last_login_at;
    
    const summary = await aiEmployeeService.generateEmployeeSummary(user);
    res.json(success({ summary }));
  } catch (error) {
    res.status(500).json(fail('Failed to generate summary'));
  }
});

router.get('/ai/onboarding', async (req, res) => {
  try {
    const { role_id, department_id } = req.query;
    let roleName = 'Employee';
    let deptName = 'General';
    
    if (role_id) {
      const r = await pool.query('SELECT name FROM roles WHERE id=$1 AND tenant_id=$2', [role_id, req.tenantId]);
      if (r.rows.length) roleName = r.rows[0].name;
    }
    if (department_id) {
      const d = await pool.query('SELECT name FROM departments WHERE id=$1 AND tenant_id=$2', [department_id, req.tenantId]);
      if (d.rows.length) deptName = d.rows[0].name;
    }

    const checklist = await aiEmployeeService.generateOnboardingChecklist(roleName, deptName);
    res.json(success({ checklist }));
  } catch (error) {
    res.status(500).json(fail('Failed to generate checklist'));
  }
});

router.get('/', async (req, res) => {

  const tenantId = req.tenantId;
  const { search, role, status, page, limit, department_id, manager_id, branch_id, joining_month, no_logins, no_projects, no_tasks, inactive_locked } = req.query;

  try {
    let query = `
      SELECT u.*, r.name as role_name, r.permissions
      FROM users u LEFT JOIN roles r ON r.id=u.role_id
      WHERE u.tenant_id=$1 AND u.deleted_at IS NULL
    `;
    const params = [tenantId];

    if (search) {
      params.push(`%${search}%`);
      query += ` AND (u.name ILIKE $${params.length} OR u.email ILIKE $${params.length} OR CAST(u.profile_data AS TEXT) ILIKE $${params.length})`;
    }

    if (role) {
      params.push(role);
      query += ` AND r.name = $${params.length}`;
    }

    if (status) {
      params.push(status);
      query += ` AND u.status = $${params.length}`;
    }

    if (department_id) {
      params.push(department_id);
      query += ` AND u.department_id = $${params.length}`;
    }

    if (manager_id) {
      params.push(manager_id);
      query += ` AND u.manager_id = $${params.length}`;
    }

    if (branch_id) {
      params.push(branch_id);
      query += ` AND u.branch_id = $${params.length}`;
    }

    if (joining_month === 'true') {
      query += ` AND EXTRACT(MONTH FROM u.created_at) = EXTRACT(MONTH FROM CURRENT_DATE) AND EXTRACT(YEAR FROM u.created_at) = EXTRACT(YEAR FROM CURRENT_DATE)`;
    }

    if (no_logins === 'true') {
      query += ` AND NOT EXISTS (SELECT 1 FROM login_history lh WHERE lh.user_id = u.id)`;
    }

    if (no_projects === 'true') {
      query += ` AND NOT EXISTS (SELECT 1 FROM projects p WHERE p.pm_id = u.id OR p.designer_id = u.id)`;
    }

    if (no_tasks === 'true') {
      query += ` AND NOT EXISTS (SELECT 1 FROM tasks t WHERE t.assignee_id = u.id)`;
    }

    if (inactive_locked === 'true') {
      query += ` AND u.status IN ('inactive', 'locked')`;
    }

    query += ` ORDER BY u.created_at DESC`;

    // Implement pagination
    const { getPagination } = require('../utils/pagination');
    const { limit: safeLimit, offset: safeOffset } = getPagination(page, limit);
    params.push(safeLimit);
    query += ` LIMIT $${params.length}`;
    params.push(safeOffset);
    query += ` OFFSET $${params.length}`;

    const { rows } = await pool.query(query, params);
    
    // Remove password hashes from response
    const safeUsers = rows.map(u => {
      const { password_hash: _password_hash, ...rest } = u;
      return rest;
    });

    console.log(`[DEBUG] GET /users for tenant ${tenantId}. Total fetched: ${safeUsers.length}. Pending approvals count: ${safeUsers.filter(u => u.status === 'pending_approval').length}`);

    return success(res, safeUsers);
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Users fetch failed', 500);
  }
});

router.get('/resource-capacity', async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const query = `
      SELECT 
        u.id, 
        u.name, 
        u.email, 
        u.avatar_url, 
        u.status,
        r.name as role_name, 
        u.weekly_capacity,
        COALESCE(
          (
            SELECT json_agg(json_build_object(
              'id', p.id,
              'name', p.name,
              'project_type', p.project_type,
              'status', p.status,
              'pm_hours_allocated', p.pm_hours_allocated,
              'designer_hours_allocated', p.designer_hours_allocated,
              'hours_allocated', CASE 
                WHEN p.pm_id = u.id AND p.designer_id = u.id THEN (p.pm_hours_allocated + p.designer_hours_allocated)
                WHEN p.pm_id = u.id THEN p.pm_hours_allocated 
                ELSE p.designer_hours_allocated 
              END
            ))
            FROM projects p
            WHERE (p.pm_id = u.id OR p.designer_id = u.id) AND p.status = 'active' AND p.deleted_at IS NULL
          ),
          '[]'::json
        ) as active_projects
      FROM users u
      LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.tenant_id = $1 AND u.deleted_at IS NULL AND u.status = 'active'
      ORDER BY r.name, u.name;
    `;
    const { rows } = await pool.query(query, [tenantId]);
    return success(res, rows);
  } catch (error) {
    console.error('[Users Router] resource-capacity fetch failed:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch resource capacity data', 500);
  }
});

// Get Single User Details
router.get('/:id', async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.params.id;
  try {
    const { rows } = await pool.query(`
      SELECT u.*, r.name as role_name, r.permissions
      FROM users u LEFT JOIN roles r ON r.id = u.role_id
      WHERE u.id = $1 AND u.tenant_id = $2 AND u.deleted_at IS NULL
    `, [userId, tenantId]);
    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'User not found', 404);
    const { password_hash, ...safeUser } = rows[0];
    return success(res, safeUser);
  } catch(error) {
    return fail(res, 'INTERNAL_ERROR', 'User fetch failed', 500);
  }
});

// Get User Projects
router.get('/:id/projects', async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.params.id;
  try {
    const { rows } = await pool.query(`
      SELECT id, name, status, project_type, start_date, expected_completion_date 
      FROM projects 
      WHERE tenant_id = $1 AND (pm_id = $2 OR designer_id = $2) AND deleted_at IS NULL
      ORDER BY created_at DESC
    `, [tenantId, userId]);
    return success(res, rows);
  } catch(error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch user projects', 500);
  }
});

// Get User Tasks
router.get('/:id/tasks', async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.params.id;
  try {
    const { rows } = await pool.query(`
      SELECT t.id, t.title, t.status, t.due_date, t.priority, p.name as project_name
      FROM tasks t
      LEFT JOIN projects p ON p.id = t.project_id
      WHERE t.tenant_id = $1 AND t.assignee_id = $2 AND t.deleted_at IS NULL
      ORDER BY t.due_date ASC NULLS LAST, t.created_at DESC
    `, [tenantId, userId]);
    return success(res, rows);
  } catch(error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch user tasks', 500);
  }
});

// Get User Sessions (Login History & Devices)
router.get('/:id/sessions', async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.params.id;
  try {
    const { rows } = await pool.query(`
      SELECT id, ip_address, user_agent, created_at, last_active_at, expires_at 
      FROM sessions 
      WHERE user_id = $1
      ORDER BY last_active_at DESC
    `, [userId]); // Sessions table might not have tenant_id, but user_id secures it implicitly if they belong to same tenant (which they do since we authenticate admin).
    return success(res, rows);
  } catch(error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch user sessions', 500);
  }
});

// Get User Login History
router.get('/:id/login-history', async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.params.id;
  try {
    const { rows } = await pool.query(`
      SELECT 
        id, ip_address, user_agent, browser, os, device,
        login_time, logout_time, duration_seconds, status, failure_reason, session_id as active_session_id
      FROM login_history 
      WHERE user_id = $1
      ORDER BY login_time DESC
    `, [userId]);
    return success(res, rows);
  } catch(error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch user login history', 500);
  }
});


// Get User Timeline (Aggregated Events)
router.get('/:id/timeline', async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.params.id;
  try {
    const { rows } = await pool.query(`
      -- 1. Audit Logs where user is the subject (entity = 'user', entity_id = $2)
      SELECT 
        id::text, 
        action as type,
        action as title,
        CASE 
          WHEN old_value IS NOT NULL AND new_value IS NOT NULL THEN CONCAT('Changed from ', old_value, ' to ', new_value)
          ELSE 'Event logged'
        END as description,
        created_at as timestamp,
        (SELECT name FROM users WHERE id = audit_logs.user_id) as actor_name,
        'log' as source
      FROM audit_logs
      WHERE tenant_id = $1 AND entity = 'user' AND entity_id = $2

      UNION ALL

      -- 2. Project Assignments (where user is pm or designer)
      SELECT 
        p.id::text,
        'project.assigned' as type,
        'Project Assigned' as title,
        CONCAT('Assigned to project: ', p.name) as description,
        p.created_at as timestamp,
        'System' as actor_name,
        'project' as source
      FROM projects p
      WHERE p.tenant_id = $1 AND (p.pm_id = $2 OR p.designer_id = $2)

      UNION ALL

      -- 3. Task Assignments
      SELECT
        t.id::text,
        'task.assigned' as type,
        'Task Assigned' as title,
        CONCAT('Assigned task: ', t.title) as description,
        t.created_at as timestamp,
        'System' as actor_name,
        'task' as source
      FROM tasks t
      WHERE t.tenant_id = $1 AND t.assignee_id = $2

      UNION ALL

      -- 4. Status History
      SELECT
        h.id::text,
        'status.changed' as type,
        'Status Changed' as title,
        CONCAT('Status changed from ', h.old_status, ' to ', h.new_status, CASE WHEN h.reason IS NOT NULL THEN CONCAT(' (', h.reason, ')') ELSE '' END) as description,
        h.created_at as timestamp,
        u.name as actor_name,
        'status_history' as source
      FROM user_status_history h
      LEFT JOIN users u ON u.id = h.changed_by
      WHERE h.tenant_id = $1 AND h.user_id = $2

      ORDER BY timestamp DESC
      LIMIT 100
    `, [tenantId, userId]);

    // Format events for frontend
    const events = rows.map(r => {
      let icon = '🔄';
      let title = r.title;
      
      // Parse specific audit actions
      if (r.type === 'employee.created' || r.type === 'user.created') { icon = '➕'; title = 'Employee Created'; }
      if (r.type === 'employee.approved') { icon = '✅'; title = 'Employee Approved'; }
      if (r.type === 'employee.rejected') { icon = '❌'; title = 'Employee Rejected'; }
      if (r.type === 'employee.role_changed' || r.type === 'user.role_changed') { icon = '🎭'; title = 'Role Changed'; }
      if (r.type === 'employee.permissions_updated') { icon = '🔐'; title = 'Permissions Updated'; }
      if (r.type === 'employee.suspended' || r.type === 'user.suspended') { icon = '⏸️'; title = 'Account Suspended'; }
      if (r.type === 'employee.activated' || r.type === 'user.activated') { icon = '▶️'; title = 'Account Activated'; }
      if (r.type === 'employee.deactivated' || r.type === 'user.deactivated') { icon = '⏹️'; title = 'Account Deactivated'; }
      if (r.type === 'employee.deleted' || r.type === 'user.deleted') { icon = '🗑️'; title = 'Account Deleted'; }
      if (r.type === 'employee.password_reset' || r.type === 'user.password_reset') { icon = '🔑'; title = 'Password Reset'; }
      if (r.type === 'employee.login' || r.type === 'user.login') { icon = '🖥️'; title = 'Logged In'; }
      if (r.type === 'employee.logout' || r.type === 'user.logout') { icon = '🚪'; title = 'Logged Out'; }
      
      if (r.type === 'project.assigned') { icon = '📁'; title = r.title; }
      if (r.type === 'task.assigned') { icon = '☑️'; title = r.title; }
      if (r.type === 'status.changed') { icon = '🚦'; title = r.title; }

      return {
        id: r.id + '-' + r.source,
        type: r.type,
        title: title,
        description: r.description,
        actor_name: r.actor_name || 'System',
        timestamp: r.timestamp,
        icon: icon
      };
    });

    return success(res, events);
  } catch(error) {
    console.error('Timeline fetch error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch user timeline', 500);
  }
});

// Get User Audit Logs
router.get('/:id/audit', async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.params.id;
  try {
    const { rows } = await pool.query(`
      SELECT id, action, entity, entity_id, ip_address, created_at 
      FROM audit_logs 
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY created_at DESC
      LIMIT 100
    `, [tenantId, userId]);
    return success(res, rows);
  } catch(error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch user audit logs', 500);
  }
});

router.patch('/:id', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const userIdToUpdate = req.params.id;
  const reviewerId = req.user.userId;
  const { name, roleId, status, status_reason, avatar_url, weekly_capacity } = req.body;

  try {
    const { rows: currentUserRows } = await pool.query('SELECT status FROM users WHERE id=$1 AND tenant_id=$2', [userIdToUpdate, tenantId]);
    if (currentUserRows.length === 0) return fail(res, 'NOT_FOUND', 'User not found', 404);
    
    const oldStatus = currentUserRows[0].status;

    if (status && status !== oldStatus) {
      const allowed = VALID_TRANSITIONS[oldStatus] || [];
      if (!allowed.includes(status)) {
        return fail(res, 'VALIDATION_ERROR', `Invalid status transition from '${oldStatus}' to '${status}'`, 400);
      }
    }

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
    if (weekly_capacity !== undefined) {
      params.push(weekly_capacity === null ? null : Number(weekly_capacity));
      updates.push(`weekly_capacity = $${params.length}`);
    }

    if (updates.length === 0) {
      return fail(res, 'VALIDATION_ERROR', 'No fields to update', 400);
    }

    updates.push('updated_at = NOW()');

    const { rows } = await pool.query(`
      UPDATE users SET ${updates.join(', ')}
      WHERE id=$1 AND tenant_id=$2
      RETURNING *
    `, params);

    if (status && status !== oldStatus) {
      await pool.query(
        `INSERT INTO user_status_history (tenant_id, user_id, changed_by, old_status, new_status, reason) VALUES ($1, $2, $3, $4, $5, $6)`,
        [tenantId, userIdToUpdate, reviewerId, oldStatus, status, status_reason || null]
      );
      
      // Email Triggers for Status Change
      const targetUser = rows[0];
      if (status === 'locked') {
        queueEmail(tenantId, userIdToUpdate, targetUser.email, 'Account Locked', 'account_locked', { name: targetUser.name });
      } else if (status === 'active' && ['inactive', 'suspended', 'locked'].includes(oldStatus)) {
        queueEmail(tenantId, userIdToUpdate, targetUser.email, 'Account Activated', 'account_activated', { name: targetUser.name });
      } else if (['inactive', 'suspended', 'deactivated'].includes(status) && oldStatus === 'active') {
        queueEmail(tenantId, userIdToUpdate, targetUser.email, 'Account Deactivated', 'account_deactivated', { name: targetUser.name });
      }
    }

    if (roleId) {
       const targetUser = rows[0];
       const { rows: roleRows } = await pool.query('SELECT name FROM roles WHERE id=$1', [roleId]);
       if (roleRows.length > 0) {
         queueEmail(tenantId, userIdToUpdate, targetUser.email, 'Role Updated', 'role_changed', { name: targetUser.name, newRole: roleRows[0].name });
         const { logAction } = require('../services/auditLog');
         await logAction({ tenantId, userId: reviewerId, action: 'employee.role_changed', entity: 'user', entityId: userIdToUpdate, newValue: { role: roleRows[0].name } });
       }
    }

    const { password_hash: _password_hash, ...safeUser } = rows[0];
    return success(res, safeUser);
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'User update failed', 500);
  }
});

router.post('/add-member', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const { name, email, roleId, ...profile_data } = req.body;

  try {
    const checkRes = await pool.query(`SELECT id FROM users WHERE email=$1 AND tenant_id=$2`, [email, tenantId]);
    if (checkRes.rows.length > 0) {
      return fail(res, 'VALIDATION_ERROR', 'Email already registered in this tenant', 400);
    }

    // Generate a temporary password hash to satisfy DB constraints, 
    // but no usable credentials will be provided until approval.
    const tempPasswordPlain = crypto.randomBytes(16).toString('hex');
    const tempPasswordHash = await bcrypt.hash(tempPasswordPlain, 10);

    const { rows } = await pool.query(`
      INSERT INTO users (tenant_id, name, email, role_id, status, password_hash, profile_data)
      VALUES ($1, $2, $3, $4, 'pending_approval', $5, $6)
      RETURNING *
    `, [tenantId, name, email, roleId, tempPasswordHash, JSON.stringify(profile_data)]);

    const newUserId = rows[0].id;
    const { logAction } = require('../services/auditLog');
    await logAction({ tenantId, userId: req.user.userId, action: 'employee.created', entity: 'user', entityId: newUserId });
    
    // Send Member Added Email
    queueEmail(tenantId, newUserId, email, 'Welcome to CRM', 'member_added', { name });
    
    // Notify Admins
    const { rows: admins } = await pool.query(`SELECT email FROM users WHERE tenant_id=$1 AND role_id=(SELECT id FROM roles WHERE name='Super Admin' LIMIT 1)`, [tenantId]);
    admins.forEach(admin => {
      queueEmail(tenantId, admin.id, admin.email, 'New Employee Approval Request', 'approval_request', { employeeName: name });
    });

    const { password_hash: _password_hash, ...safeUser } = rows[0];
    return success(res, safeUser);
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to add team member', 500);
  }
});

router.delete('/:id', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const userIdToDelete = req.params.id;

  try {
    const { rowCount } = await pool.query(
      `UPDATE users SET deleted_at = NOW() WHERE id = $1 AND tenant_id = $2 AND deleted_at IS NULL`,
      [userIdToDelete, tenantId]
    );

    if (rowCount === 0) {
      return fail(res, 'NOT_FOUND', 'User not found or already deleted', 404);
    }

    const { logAction } = require('../services/auditLog');
    await logAction({ tenantId, userId: req.user.userId, action: 'employee.deleted', entity: 'user', entityId: userIdToDelete });
    return success(res, { message: 'User deleted successfully' });
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'User deletion failed', 500);
  }
});

router.post('/:id/approve', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.params.id;
  const reviewerId = req.user.userId;
  const { comments } = req.body;

  try {
    const { rows: uRows } = await pool.query(`SELECT profile_data FROM users WHERE id = $1 AND tenant_id = $2`, [userId, tenantId]);
    if (uRows.length === 0) return fail(res, 'NOT_FOUND', 'User not found', 404);
    
    const profileData = uRows[0].profile_data || {};
    const plainPassword = profileData.tempPassword || (crypto.randomBytes(8).toString('hex') + '!A');
    const passwordHash = await bcrypt.hash(plainPassword, 10);

    const { rowCount, rows } = await pool.query(
      `UPDATE users SET status = 'active', password_hash = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *`,
      [passwordHash, userId, tenantId]
    );

    if (rowCount === 0) return fail(res, 'NOT_FOUND', 'User not found', 404);

    await pool.query(
      `INSERT INTO employee_approvals (tenant_id, user_id, reviewer_id, status, comments) VALUES ($1, $2, $3, 'approved', $4)`,
      [tenantId, userId, reviewerId, comments || '']
    );

    logAction({ tenantId, userId: reviewerId, action: 'employee.approved', entity: 'user', entityId: userId });
    
    const uEmail = rows[0].email;
    const uName = rows[0].name;
    const { rows: roleRows } = await pool.query('SELECT name FROM roles WHERE id=$1', [rows[0].role_id]);
    const roleName = roleRows[0]?.name || 'Employee';

    queueEmail(tenantId, userId, uEmail, 'Account Approved', 'approval_granted', { name: uName });
    queueEmail(tenantId, userId, uEmail, 'Welcome to the Team', 'welcome_email', { name: uName, role: roleName });
    
    // Provide a mock frontend link to set password since we don't have a real one
    const setupUrl = `http://localhost:5173/set-password?token=${plainPassword}`;
    queueEmail(tenantId, userId, uEmail, 'Create Your Password', 'create_password', { name: uName, email: uEmail, setupUrl });

    return success(res, { message: 'User approved successfully' });
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to approve user', 500);
  }
});

router.post('/:id/reject', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.params.id;
  const reviewerId = req.user.userId;
  const { comments } = req.body;

  if (!comments) return fail(res, 'VALIDATION_ERROR', 'Rejection reason is required', 400);

  try {
    const { rowCount, rows } = await pool.query(
      `UPDATE users SET status = 'rejected' WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [userId, tenantId]
    );

    if (rowCount === 0) return fail(res, 'NOT_FOUND', 'User not found', 404);

    await pool.query(
      `INSERT INTO employee_approvals (tenant_id, user_id, reviewer_id, status, comments) VALUES ($1, $2, $3, 'rejected', $4)`,
      [tenantId, userId, reviewerId, comments]
    );

    logAction({ tenantId, userId: reviewerId, action: 'employee.rejected', entity: 'user', entityId: userId });
    queueEmail(tenantId, userId, rows[0].email, 'Account Application Update', 'approval_rejected', { name: rows[0].name, reason: comments });

    return success(res, { message: 'User rejected successfully' });
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to reject user', 500);
  }
});

router.post('/:id/request-changes', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.params.id;
  const reviewerId = req.user.userId;
  const { comments } = req.body;

  if (!comments) return fail(res, 'VALIDATION_ERROR', 'Change request details are required', 400);

  try {
    const { rowCount, rows } = await pool.query(
      `UPDATE users SET status = 'changes_requested' WHERE id = $1 AND tenant_id = $2 RETURNING *`,
      [userId, tenantId]
    );

    if (rowCount === 0) return fail(res, 'NOT_FOUND', 'User not found', 404);

    await pool.query(
      `INSERT INTO employee_approvals (tenant_id, user_id, reviewer_id, status, comments) VALUES ($1, $2, $3, 'changes_requested', $4)`,
      [tenantId, userId, reviewerId, comments]
    );

    logAction({ tenantId, userId: reviewerId, action: 'employee.changes_requested', entity: 'user', entityId: userId });

    return success(res, { message: 'Change request submitted' });
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to request changes', 500);
  }
});

router.get('/:id/approval-history', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.params.id;

  try {
    const { rows } = await pool.query(
      `SELECT ea.*, u.name as reviewer_name 
       FROM employee_approvals ea
       JOIN users u ON u.id = ea.reviewer_id
       WHERE ea.user_id = $1 AND ea.tenant_id = $2
       ORDER BY ea.created_at DESC`,
      [userId, tenantId]
    );
    return success(res, rows);
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch approval history', 500);
  }
});

router.get('/:id/status-history', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.params.id;

  try {
    const { rows } = await pool.query(
      `SELECT us.*, u.name as changed_by_name 
       FROM user_status_history us
       LEFT JOIN users u ON u.id = us.changed_by
       WHERE us.user_id = $1 AND us.tenant_id = $2
       ORDER BY us.created_at DESC`,
      [userId, tenantId]
    );
    return success(res, rows);
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch status history', 500);
  }
});

module.exports = router;
