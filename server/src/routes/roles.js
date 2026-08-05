const logger = require('../utils/logger');
const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { success, fail } = require('../utils/response');
const pool = require('../config/db');
const { queueEmail } = require('../services/emailService');
const { logActivity } = require('../utils/activityLogger');
const { PERMISSION_MODULES, PERMISSION_ACTIONS, isValidPermission, ACTION_DEPENDENCIES } = require('../constants/permissions');

const validateDependencies = (permsArray) => {
  if (permsArray.includes('*')) return null;
  const permSet = new Set(permsArray);
  for (const perm of permsArray) {
    const [mod, action] = perm.split(':');
    if (ACTION_DEPENDENCIES[action]) {
      for (const dep of ACTION_DEPENDENCIES[action]) {
        if (!permSet.has(`${mod}:${dep}`)) {
          return `Missing dependency: '${mod}:${action}' requires '${mod}:${dep}'`;
        }
      }
    }
  }
  return null;
};

const router = express.Router();

router.use(authenticate);

// Get permissions schema for frontend rendering
router.get('/permissions-schema', authorize('users:manage'), (req, res) => {
  return success(res, { modules: PERMISSION_MODULES, actions: PERMISSION_ACTIONS });
});

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
    const parsedRows = rows.map(r => {
      let p = typeof r.permissions === 'string' ? JSON.parse(r.permissions || '[]') : (r.permissions || []);
      let actions = Array.isArray(p) ? p : (p.actions || []);
      let scopes = Array.isArray(p) ? {} : (p.scopes || {});
      let fields = Array.isArray(p) ? {} : (p.fields || {});
      let modules = Array.isArray(p) ? [] : (p.modules || []);
      let pages = Array.isArray(p) ? {} : (p.pages || {});
      return { ...r, permissions: actions, data_scopes: scopes, field_permissions: fields, enabled_modules: modules, page_permissions: pages, security_policies: r.security_policies || {} };
    });

    return success(res, parsedRows);
  } catch (error) {
    logger.error('[Roles API] Fetch error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch roles', 500);
  }
});

// Create a new role
router.post('/', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const { name, permissions, data_scopes, field_permissions, enabled_modules, page_permissions } = req.body;

  if (!name) {
    return fail(res, 'VALIDATION_ERROR', 'Role name is required', 400);
  }

  // Validate and deduplicate permissions
  let validPermissions = [];
  if (Array.isArray(permissions)) {
    const uniquePerms = [...new Set(permissions)];
    validPermissions = uniquePerms.filter(isValidPermission);
  }

  const depError = validateDependencies(validPermissions);
  if (depError) {
    return fail(res, 'VALIDATION_ERROR', depError, 400);
  }
  
  const change_summary = req.body.change_summary || 'Initial creation';

  try {
    const query = `
      INSERT INTO roles (tenant_id, name, permissions, security_policies)
      VALUES ($1, $2, $3, $4)
      RETURNING id, name, permissions, security_policies, is_system, created_at
    `;
    const permsStr = JSON.stringify({ actions: validPermissions, scopes: data_scopes || {}, fields: field_permissions || {}, modules: enabled_modules || [], pages: page_permissions || {} });
    const securityPoliciesStr = JSON.stringify(req.body.security_policies || {});
    const { rows } = await pool.query(query, [tenantId, name, permsStr, securityPoliciesStr]);

    let p = typeof rows[0].permissions === 'string' ? JSON.parse(rows[0].permissions || '[]') : (rows[0].permissions || []);
    let actions = Array.isArray(p) ? p : (p.actions || []);
    let scopes = Array.isArray(p) ? {} : (p.scopes || {});
    let fields = Array.isArray(p) ? {} : (p.fields || {});
    let modules = Array.isArray(p) ? [] : (p.modules || []);
    let pages = Array.isArray(p) ? {} : (p.pages || {});

    const newRole = {
      ...rows[0],
      permissions: actions,
      data_scopes: scopes,
      field_permissions: fields,
      enabled_modules: modules,
      page_permissions: pages,
      security_policies: rows[0].security_policies || {}
    };

    // Log Activity
    await logActivity(req, 'role', newRole.id, 'Created', null, JSON.stringify({
      name: newRole.name,
      permissions: actions,
      data_scopes: scopes,
      field_permissions: fields,
      enabled_modules: modules,
      page_permissions: pages
    }), change_summary);

    // Insert Version 1
    await pool.query(`
      INSERT INTO role_versions (tenant_id, role_id, version_number, user_id, permissions, data_scopes, field_permissions, enabled_modules, page_permissions, change_summary)
      VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9)
    `, [tenantId, newRole.id, req.user?.id || req.user?.userId || null, JSON.stringify(actions), JSON.stringify(scopes), JSON.stringify(fields), JSON.stringify(modules), JSON.stringify(pages), change_summary]);

    return success(res, newRole);
  } catch (error) {
    logger.error('[Roles API] Create error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to create role', 500);
  }
});

// Get all templates
router.get('/templates', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  try {
    const { rows } = await pool.query(`
      SELECT id, name, description, category, permissions, created_at 
      FROM role_templates 
      WHERE tenant_id = $1 OR tenant_id IS NULL
      ORDER BY category ASC, name ASC
    `, [tenantId]);

    // Parse permissions and inject hardcoded templates if DB is empty
    const builtinTemplates = [
      { id: 't-sales', name: 'Sales', category: 'built-in', permissions: { actions: ['leads:view', 'leads:create', 'leads:edit', 'quotations:view', 'quotations:create'] } },
      { id: 't-designer', name: 'Designer', category: 'built-in', permissions: { actions: ['projects:view', 'tasks:view', 'tasks:edit', 'boq:view', 'boq:create', 'design_reviews:view', 'design_reviews:create'] } },
      { id: 't-pm', name: 'Project Manager', category: 'built-in', permissions: { actions: ['projects:view', 'projects:edit', 'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'boq:view', 'material_requests:view', 'material_requests:create'] } },
      { id: 't-finance', name: 'Finance', category: 'built-in', permissions: { actions: ['finance:view_finance_dashboard', 'finance:view_cost', 'finance:view_profit', 'finance:view_margin', 'invoices:view', 'invoices:create', 'payments:view', 'payments:create', 'payments:approve'] } },
      { id: 't-warehouse', name: 'Warehouse', category: 'built-in', permissions: { actions: ['warehouse:inventory_view', 'warehouse:stock_adjustment', 'warehouse:issue_material', 'warehouse:receive_material', 'warehouse:transfer_stock'] } },
      { id: 't-factory', name: 'Factory', category: 'built-in', permissions: { actions: ['factory:production_planning', 'factory:production_status', 'factory:assign_workers', 'factory:quality_check', 'factory:dispatch'] } },
      { id: 't-admin', name: 'Admin', category: 'built-in', permissions: { actions: ['*'] } }
    ];

    const dbTemplates = rows.map(r => ({
      ...r,
      permissions: typeof r.permissions === 'string' ? JSON.parse(r.permissions) : r.permissions
    }));

    // Merge builtins if not present in DB
    const allTemplates = [...builtinTemplates, ...dbTemplates.filter(db => db.category !== 'built-in')];
    
    return success(res, allTemplates);
  } catch (error) {
    logger.error('[Roles API] Fetch templates error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch templates', 500);
  }
});

// Save role as a custom template
router.post('/templates', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const { name, description, permissions, data_scopes, field_permissions, enabled_modules, page_permissions } = req.body;

  if (!name) return fail(res, 'VALIDATION_ERROR', 'Template name is required', 400);

  const validPermissions = permissions || [];
  const depError = validateDependencies(validPermissions);
  if (depError) {
    return fail(res, 'VALIDATION_ERROR', depError, 400);
  }

  const permsObj = {
    actions: validPermissions,
    scopes: data_scopes || {},
    fields: field_permissions || {},
    modules: enabled_modules || [],
    pages: page_permissions || {}
  };

  try {
    const query = `
      INSERT INTO role_templates (tenant_id, name, description, category, permissions)
      VALUES ($1, $2, $3, 'custom', $4)
      RETURNING *
    `;
    const { rows } = await pool.query(query, [tenantId, name, description, JSON.stringify(permsObj)]);
    return success(res, { ...rows[0], permissions: permsObj });
  } catch (error) {
    logger.error('[Roles API] Create template error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to save template', 500);
  }
});

// Bulk Import Roles
router.post('/bulk-import', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const { roles } = req.body;

  if (!Array.isArray(roles) || roles.length === 0) {
    return fail(res, 'VALIDATION_ERROR', 'A valid array of roles is required', 400);
  }

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    const importedRoles = [];
    for (const r of roles) {
      const actions = Array.isArray(r.permissions) ? r.permissions : [];
      const scopes = typeof r.data_scopes === 'object' ? r.data_scopes : {};
      const fields = typeof r.field_permissions === 'object' ? r.field_permissions : {};
      const modules = Array.isArray(r.enabled_modules) ? r.enabled_modules : [];
      const pages = typeof r.page_permissions === 'object' ? r.page_permissions : {};
      const policies = typeof r.security_policies === 'object' ? r.security_policies : {};
      
      const { rows } = await client.query(`
        INSERT INTO roles (tenant_id, name, description, permissions, data_scopes, field_permissions, enabled_modules, page_permissions, security_policies)
        VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9)
        RETURNING *
      `, [tenantId, r.name, r.description || '', JSON.stringify(actions), JSON.stringify(scopes), JSON.stringify(fields), JSON.stringify(modules), JSON.stringify(pages), JSON.stringify(policies)]);
      
      const newRole = rows[0];
      
      await client.query(`
        INSERT INTO role_versions (tenant_id, role_id, version_number, user_id, permissions, data_scopes, field_permissions, enabled_modules, page_permissions, change_summary)
        VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, 'Initial bulk import')
      `, [tenantId, newRole.id, req.user?.id || req.user?.userId || null, JSON.stringify(actions), JSON.stringify(scopes), JSON.stringify(fields), JSON.stringify(modules), JSON.stringify(pages)]);
      
      importedRoles.push(newRole);
    }

    await client.query('COMMIT');
    return success(res, importedRoles);
  } catch (error) {
    await client.query('ROLLBACK');
    logger.error('[Roles API] Bulk import error:', error);
    // 23505 is PostgreSQL unique violation code
    if (error.code === '23505') {
       return fail(res, 'VALIDATION_ERROR', 'One of the imported roles already exists (duplicate name)', 409);
    }
    return fail(res, 'INTERNAL_ERROR', 'Failed to bulk import roles', 500);
  } finally {
    client.release();
  }
});


// Clone role or create from template
router.post('/clone', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const { sourceId, newName, isTemplate } = req.body;

  if (!sourceId || !newName) {
    return fail(res, 'VALIDATION_ERROR', 'Source ID and new name are required', 400);
  }

  try {
    let sourcePermsStr = '{}';

    if (isTemplate) {
      // First check hardcoded built-ins
      const builtinTemplates = {
        't-sales': { actions: ['leads:view', 'leads:create', 'leads:edit', 'quotations:view', 'quotations:create'] },
        't-designer': { actions: ['projects:view', 'tasks:view', 'tasks:edit', 'boq:view', 'boq:create', 'design_reviews:view', 'design_reviews:create'] },
        't-pm': { actions: ['projects:view', 'projects:edit', 'tasks:view', 'tasks:create', 'tasks:edit', 'tasks:delete', 'boq:view', 'material_requests:view', 'material_requests:create'] },
        't-finance': { actions: ['finance:view_finance_dashboard', 'finance:view_cost', 'finance:view_profit', 'finance:view_margin', 'invoices:view', 'invoices:create', 'payments:view', 'payments:create', 'payments:approve'] },
        't-warehouse': { actions: ['warehouse:inventory_view', 'warehouse:stock_adjustment', 'warehouse:issue_material', 'warehouse:receive_material', 'warehouse:transfer_stock'] },
        't-factory': { actions: ['factory:production_planning', 'factory:production_status', 'factory:assign_workers', 'factory:quality_check', 'factory:dispatch'] },
        't-admin': { actions: ['*'] }
      };

      if (builtinTemplates[sourceId]) {
        sourcePermsStr = JSON.stringify(builtinTemplates[sourceId]);
      } else {
        const { rows } = await pool.query('SELECT permissions FROM role_templates WHERE id = $1 AND (tenant_id = $2 OR tenant_id IS NULL)', [sourceId, tenantId]);
        if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Template not found', 404);
        sourcePermsStr = typeof rows[0].permissions === 'string' ? rows[0].permissions : JSON.stringify(rows[0].permissions);
      }
    } else {
      const { rows } = await pool.query('SELECT permissions FROM roles WHERE id = $1 AND tenant_id = $2', [sourceId, tenantId]);
      if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Source role not found', 404);
      sourcePermsStr = typeof rows[0].permissions === 'string' ? rows[0].permissions : JSON.stringify(rows[0].permissions);
    }

    const insertQuery = `
      INSERT INTO roles (tenant_id, name, permissions)
      VALUES ($1, $2, $3)
      RETURNING id, name, permissions, is_system, created_at
    `;
    const { rows: newRows } = await pool.query(insertQuery, [tenantId, newName, sourcePermsStr]);
    
    let p = typeof newRows[0].permissions === 'string' ? JSON.parse(newRows[0].permissions || '[]') : (newRows[0].permissions || []);
    let actions = Array.isArray(p) ? p : (p.actions || []);
    let scopes = Array.isArray(p) ? {} : (p.scopes || {});
    let fields = Array.isArray(p) ? {} : (p.fields || {});
    let modules = Array.isArray(p) ? [] : (p.modules || []);
    let pages = Array.isArray(p) ? {} : (p.pages || {});

    const newRole = {
      ...newRows[0],
      permissions: actions,
      data_scopes: scopes,
      field_permissions: fields,
      enabled_modules: modules,
      page_permissions: pages
    };

    // Log Activity
    await logActivity(req, 'role', newRole.id, 'Created', null, JSON.stringify({
      name: newRole.name,
      permissions: actions,
      data_scopes: scopes,
      field_permissions: fields,
      enabled_modules: modules,
      page_permissions: pages
    }), `Cloned role from ${sourceId}`);

    // Insert Version 1
    await pool.query(`
      INSERT INTO role_versions (tenant_id, role_id, version_number, user_id, permissions, data_scopes, field_permissions, enabled_modules, page_permissions, change_summary)
      VALUES ($1, $2, 1, $3, $4, $5, $6, $7, $8, $9)
    `, [tenantId, newRole.id, req.user?.id || req.user?.userId || null, JSON.stringify(actions), JSON.stringify(scopes), JSON.stringify(fields), JSON.stringify(modules), JSON.stringify(pages), `Cloned role from ${sourceId}`]);

    return success(res, newRole);
  } catch (error) {
    logger.error('[Roles API] Clone error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to clone role', 500);
  }
});

// Update a role
router.patch('/:id', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const roleId = req.params.id;
  const { name, permissions, data_scopes, field_permissions, enabled_modules, page_permissions, security_policies } = req.body;

  try {
    const { rows: roleRows } = await pool.query('SELECT * FROM roles WHERE id=$1 AND tenant_id=$2', [roleId, tenantId]);
    if (roleRows.length === 0) return fail(res, 'NOT_FOUND', 'Role not found', 404);
    if (roleRows[0].is_system) return fail(res, 'VALIDATION_ERROR', 'Cannot modify system roles', 400);

    let permsStr = null;
    // We update the permissions column if either permissions, data_scopes, field_permissions, enabled_modules, or page_permissions is provided
    if (permissions !== undefined || data_scopes !== undefined || field_permissions !== undefined || enabled_modules !== undefined || page_permissions !== undefined) {
      let p = typeof roleRows[0].permissions === 'string' ? JSON.parse(roleRows[0].permissions || '[]') : (roleRows[0].permissions || []);
      let existingActions = Array.isArray(p) ? p : (p.actions || []);
      let existingScopes = Array.isArray(p) ? {} : (p.scopes || {});
      let existingFields = Array.isArray(p) ? {} : (p.fields || {});
      let existingModules = Array.isArray(p) ? [] : (p.modules || []);
      let existingPages = Array.isArray(p) ? {} : (p.pages || {});

      let validPermissions = existingActions;
      if (permissions !== undefined) {
        if (Array.isArray(permissions)) {
          const uniquePerms = [...new Set(permissions)];
          validPermissions = uniquePerms.filter(isValidPermission);
        } else {
          validPermissions = [];
        }
      }

      const depError = validateDependencies(validPermissions);
      if (depError) {
        return fail(res, 'VALIDATION_ERROR', depError, 400);
      }

      let newScopes = data_scopes !== undefined ? data_scopes : existingScopes;
      let newFields = field_permissions !== undefined ? field_permissions : existingFields;
      let newModules = enabled_modules !== undefined ? enabled_modules : existingModules;
      let newPages = page_permissions !== undefined ? page_permissions : existingPages;

      permsStr = JSON.stringify({ actions: validPermissions, scopes: newScopes, fields: newFields, modules: newModules, pages: newPages });

      await logActivity(req, 'role', roleId, 'Edited', JSON.stringify({
        name: roleRows[0].name,
        permissions: existingActions,
        data_scopes: existingScopes,
        field_permissions: existingFields,
        enabled_modules: existingModules,
        page_permissions: existingPages
      }), JSON.stringify({
        name: name || roleRows[0].name,
        ...JSON.parse(permsStr)
      }), 'Updated role permissions');
    } else if (name && name !== roleRows[0].name) {
      await logActivity(req, 'role', roleId, 'Edited', JSON.stringify({ name: roleRows[0].name }), JSON.stringify({ name: name || roleRows[0].name }), 'Updated role name');
    }

    // Notify all users in this role
    if (permsStr) {
      const { rows: usersInRole } = await pool.query('SELECT id, name, email FROM users WHERE role_id=$1 AND tenant_id=$2 AND status=\'active\'', [roleId, tenantId]);
      const { logAction } = require('../services/auditLog');
      for (const u of usersInRole) {
        queueEmail(tenantId, u.id, u.email, 'Permissions Updated', 'permission_updated', { name: u.name });
        await logAction({ tenantId, userId: req.user.userId, action: 'employee.permissions_updated', entity: 'user', entityId: u.id, newValue: { role: roleRows[0].name } });
      }
    }
      const { rows } = await pool.query(
        'UPDATE roles SET name=$1, permissions=$2, security_policies=$3 WHERE id=$4 AND tenant_id=$5 RETURNING *',
        [name || roleRows[0].name, permsStr || roleRows[0].permissions, security_policies ? JSON.stringify(security_policies) : roleRows[0].security_policies, roleId, tenantId]
      );
      
      let pUpdated = typeof rows[0].permissions === 'string' ? JSON.parse(rows[0].permissions || '[]') : (rows[0].permissions || []);
      let actionsUpdated = Array.isArray(pUpdated) ? pUpdated : (pUpdated.actions || []);
      let scopesUpdated = Array.isArray(pUpdated) ? {} : (pUpdated.scopes || {});
      let fieldsUpdated = Array.isArray(pUpdated) ? {} : (pUpdated.fields || {});
      let modulesUpdated = Array.isArray(pUpdated) ? [] : (pUpdated.modules || []);
      let pagesUpdated = Array.isArray(pUpdated) ? {} : (pUpdated.pages || {});

      const updatedRole = {
        ...rows[0],
        permissions: actionsUpdated,
        data_scopes: scopesUpdated,
        field_permissions: fieldsUpdated,
        enabled_modules: modulesUpdated,
        page_permissions: pagesUpdated,
        security_policies: rows[0].security_policies || {}
      };
    return success(res, updatedRole);
  } catch (error) {
    logger.error('[Roles API] Update error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update role', 500);
  }
});

// DELETE /:id - Delete a role
router.delete('/:id', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const roleId = req.params.id;

  try {
    const { rows } = await pool.query('SELECT * FROM roles WHERE id=$1 AND tenant_id=$2', [roleId, tenantId]);
    if (rows.length === 0) return fail(res, 'NOT_FOUND', 'Role not found', 404);
    if (rows[0].is_system) return fail(res, 'VALIDATION_ERROR', 'Cannot delete system roles', 400);

    // Check if role is assigned to any users
    const { rows: userRows } = await pool.query('SELECT COUNT(*) FROM users WHERE role_id=$1 AND tenant_id=$2', [roleId, tenantId]);
    if (parseInt(userRows[0].count, 10) > 0) {
      return fail(res, 'VALIDATION_ERROR', 'Cannot delete role because it is assigned to one or more users', 400);
    }

    await pool.query('DELETE FROM roles WHERE id=$1 AND tenant_id=$2', [roleId, tenantId]);
    await logActivity(req, 'role', roleId, 'Deleted', JSON.stringify({ name: rows[0].name }), null);
    
    return success(res, { deleted: true });
  } catch (error) {
    logger.error('[Roles API] Delete error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to delete role', 500);
  }
});

// GET /:id/versions - Get role versions
router.get('/:id/versions', authorize('users:manage'), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const roleId = req.params.id;
    const { rows } = await pool.query(`
      SELECT rv.*, u.name as editor_name 
      FROM role_versions rv
      LEFT JOIN users u ON rv.user_id = u.id
      WHERE rv.role_id = $1 AND rv.tenant_id = $2
      ORDER BY rv.version_number DESC
    `, [roleId, tenantId]);
    return success(res, rows);
  } catch (error) {
    logger.error('[Roles API] Get versions error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to get role versions', 500);
  }
});

// POST /:id/rollback/:versionId - Rollback to a specific version
router.patch('/:id/rollback/:versionId', authorize('users:manage'), async (req, res) => {
  try {
    const tenantId = req.tenantId;
    const roleId = req.params.id;
    const versionId = req.params.versionId;

    const { rows: versionRows } = await pool.query(`SELECT * FROM role_versions WHERE id = $1 AND role_id = $2 AND tenant_id = $3`, [versionId, roleId, tenantId]);
    if (versionRows.length === 0) return fail(res, 'NOT_FOUND', 'Version not found', 404);

    const targetVersion = versionRows[0];
    
    // We update the role with this version's data
    const newPermsObj = {
      actions: targetVersion.permissions || [],
      scopes: targetVersion.data_scopes || {},
      fields: targetVersion.field_permissions || {},
      modules: targetVersion.enabled_modules || [],
      pages: targetVersion.page_permissions || {}
    };

    const { rows: updatedRole } = await pool.query(`
      UPDATE roles SET permissions = $1 WHERE id = $2 AND tenant_id = $3 RETURNING *
    `, [JSON.stringify(newPermsObj), roleId, tenantId]);

    // Insert a new version reflecting this rollback
    const { rows: maxVRows } = await pool.query(`SELECT COALESCE(MAX(version_number), 0) as max_v FROM role_versions WHERE role_id=$1`, [roleId]);
    const nextV = (parseInt(maxVRows[0].max_v, 10) || 0) + 1;
    const change_summary = `Rolled back to Version ${targetVersion.version_number}`;

    await pool.query(`
      INSERT INTO role_versions (tenant_id, role_id, version_number, user_id, permissions, data_scopes, field_permissions, enabled_modules, page_permissions, change_summary)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10)
    `, [tenantId, roleId, nextV, req.user?.id || req.user?.userId || null, JSON.stringify(newPermsObj.actions), JSON.stringify(newPermsObj.scopes), JSON.stringify(newPermsObj.fields), JSON.stringify(newPermsObj.modules), JSON.stringify(newPermsObj.pages), change_summary]);

    // Log Activity
    await logActivity(req, 'role', roleId, 'Edited', null, JSON.stringify(newPermsObj), change_summary);

    return success(res, updatedRole[0]);
  } catch (error) {
    logger.error('[Roles API] Rollback error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to rollback role', 500);
  }
});

module.exports = router;
