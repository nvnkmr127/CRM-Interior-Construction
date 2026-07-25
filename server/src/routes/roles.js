const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { success, fail } = require('../utils/response');
const pool = require('../config/db');
const { queueEmail } = require('../services/emailService');
const { PERMISSION_MODULES, PERMISSION_ACTIONS, isValidPermission } = require('../constants/permissions');

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
      return { ...r, permissions: actions, data_scopes: scopes, field_permissions: fields, enabled_modules: modules, page_permissions: pages };
    });

    return success(res, parsedRows);
  } catch (error) {
    console.error('[Roles API] Fetch error:', error);
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

  try {
    const query = `
      INSERT INTO roles (tenant_id, name, permissions)
      VALUES ($1, $2, $3)
      RETURNING id, name, permissions, is_system, created_at
    `;
    const permsStr = JSON.stringify({ actions: validPermissions, scopes: data_scopes || {}, fields: field_permissions || {}, modules: enabled_modules || [], pages: page_permissions || {} });
    const { rows } = await pool.query(query, [tenantId, name, permsStr]);

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
      page_permissions: pages
    };
    return success(res, newRole);
  } catch (error) {
    console.error('[Roles API] Create error:', error);
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
    console.error('[Roles API] Fetch templates error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch templates', 500);
  }
});

// Save role as a custom template
router.post('/templates', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const { name, description, permissions, data_scopes, field_permissions, enabled_modules, page_permissions } = req.body;

  if (!name) return fail(res, 'VALIDATION_ERROR', 'Template name is required', 400);

  const permsObj = {
    actions: permissions || [],
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
    console.error('[Roles API] Create template error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to save template', 500);
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
    return success(res, newRole);
  } catch (error) {
    console.error('[Roles API] Clone error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to clone role', 500);
  }
});

// Update a role
router.patch('/:id', authorize('users:manage'), async (req, res) => {
  const tenantId = req.tenantId;
  const roleId = req.params.id;
  const { name, permissions, data_scopes, field_permissions, enabled_modules, page_permissions } = req.body;

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

      let newScopes = existingScopes;
      if (data_scopes !== undefined) {
        newScopes = data_scopes || {};
      }

      let newFields = existingFields;
      if (field_permissions !== undefined) {
        newFields = field_permissions || {};
      }

      let newModules = existingModules;
      if (enabled_modules !== undefined) {
        newModules = enabled_modules || [];
      }

      let newPages = existingPages;
      if (page_permissions !== undefined) {
        newPages = page_permissions || {};
      }

      permsStr = JSON.stringify({ actions: validPermissions, scopes: newScopes, fields: newFields, modules: newModules, pages: newPages });
    }

    const { rows } = await pool.query(`
      UPDATE roles SET name = COALESCE($1, name), permissions = COALESCE($2, permissions)
      WHERE id = $3 AND tenant_id = $4
      RETURNING *
    `, [name, permsStr, roleId, tenantId]);
    
    // Notify all users in this role
    if (permsStr) {
      const { rows: usersInRole } = await pool.query('SELECT id, name, email FROM users WHERE role_id=$1 AND tenant_id=$2 AND status=\'active\'', [roleId, tenantId]);
      for (const u of usersInRole) {
        queueEmail(tenantId, u.id, u.email, 'Permissions Updated', 'permission_updated', { name: u.name });
        const { logAction } = require('../services/auditLog');
        await logAction({ tenantId, userId: req.user.userId, action: 'employee.permissions_updated', entity: 'user', entityId: u.id, newValue: { role: rows[0].name } });
      }
    }

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
      page_permissions: pagesUpdated
    };
    return success(res, updatedRole);
  } catch (error) {
    console.error('[Roles API] Update error:', error);
    return fail(res, 'INTERNAL_ERROR', 'Failed to update role', 500);
  }
});

module.exports = router;
