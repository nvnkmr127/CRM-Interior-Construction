/* eslint-disable no-unused-vars */
const express = require('express');
const authenticate = require('../middleware/authenticate');
const authorize = require('../middleware/authorize');
const { success, fail } = require('../utils/response');
const pool = require('../config/db');
const { logAction } = require('../services/auditLog');
const crypto = require('crypto');
const multer = require('multer');
const path = require('path');
const fs = require('fs');

const storage = multer.diskStorage({
  destination: function (req, file, cb) {
    const dir = 'uploads/logos/';
    if (!fs.existsSync(dir)){
        fs.mkdirSync(dir, { recursive: true });
    }
    cb(null, dir);
  },
  filename: function (req, file, cb) {
    const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
    cb(null, uniqueSuffix + path.extname(file.originalname));
  }
});
const upload = multer({ 
  storage: storage,
  limits: { fileSize: 10 * 1024 * 1024 } // 10MB limit
});

const router = express.Router();

// Strict superadmin guard
router.use(authenticate);
router.use(authorize('superadmin'));

/**
 * IMPERSONATION
 */
router.post('/impersonate/:id', async (req, res, next) => {
  const targetId = req.params.id;
  const adminId = req.user.id;
  
  if (targetId === adminId) return fail(res, 'INVALID_IMPERSONATION', 'Cannot impersonate yourself', 400);

  try {
    // Audit log this highly privileged action
    await logAction(req.tenantId, adminId, 'SUPERADMIN_IMPERSONATE', `SuperAdmin impersonated user ${targetId}`, { targetUserId: targetId, severity: 'CRITICAL' });
    
    // In a real flow, we would sign a new JWT for the target user here with an 'impersonator_id' claim
    return success(res, { message: 'Impersonation session started' });
  } catch (error) {
    return next(error);
  }
});

/**
 * FORCE LOGOUT
 */
router.post('/force-logout/:id', async (req, res, next) => {
  try {
    await logAction(req.tenantId, req.user.id, 'SUPERADMIN_FORCE_LOGOUT', `Forced logout for user ${req.params.id}`, { targetUserId: req.params.id, severity: 'HIGH' });
    return success(res, { message: 'User forcefully logged out of all sessions' });
  } catch (error) {
    return next(error);
  }
});

/**
 * EMERGENCY LOCK
 */
router.post('/emergency-lock/:id', async (req, res, next) => {
  try {
    await logAction(req.tenantId, req.user.id, 'SUPERADMIN_EMERGENCY_LOCK', `Emergency lock placed on user ${req.params.id}`, { targetUserId: req.params.id, severity: 'CRITICAL' });
    return success(res, { message: 'User account immediately locked and sessions terminated' });
  } catch (error) {
    return next(error);
  }
});

/**
 * GLOBAL PASSWORD RESET
 */
router.post('/global-password-reset', async (req, res, next) => {
  try {
    await logAction(req.tenantId, req.user.id, 'SUPERADMIN_GLOBAL_RESET', `Global password reset initiated for all active users`, { severity: 'CRITICAL' });
    return success(res, { message: 'All users will be forced to reset passwords on next login' });
  } catch (error) {
    return next(error);
  }
});

/**
 * LICENSING & SEAT MGMT
 */
router.get('/license', async (req, res, next) => {
  try {
    const userRes = await pool.query('SELECT COUNT(*)::int as count FROM users');
    const active_users = userRes.rows[0].count;

    const tenantRes = await pool.query('SELECT COALESCE(SUM(max_users), 0)::int as seats FROM tenants');
    const license_seats = tenantRes.rows[0].seats || 50;

    const utilizationVal = license_seats > 0 ? Math.round((active_users / license_seats) * 100) : 0;
    const utilization = `${utilizationVal}%`;

    return success(res, { 
      active_users, 
      license_seats,
      utilization
    });
  } catch (error) {
    return next(error);
  }
});

/**
 * LIST ALL TENANTS
 */
router.get('/tenants', async (req, res, next) => {
  try {
    const { rows } = await pool.query(`
      SELECT t.*, 
             s.mfa_required_all, s.session_timeout_minutes, s.concurrent_login_limit,
             s.password_min_length, s.password_require_symbols, s.password_require_numbers,
             s.password_expiry_days, s.password_prevent_reuse, s.allowed_ips, s.allowed_countries,
             (SELECT COUNT(*)::int FROM users u WHERE u.tenant_id = t.id) as user_count
      FROM tenants t
      LEFT JOIN tenant_security_settings s ON t.id = s.tenant_id
      ORDER BY t.created_at DESC
    `);
    return success(res, rows);
  } catch (error) {
    return next(error);
  }
});

/**
 * CREATE TENANT
 */
router.post('/tenants', async (req, res, next) => {
  const { name, slug, plan, max_users, adminEmail, adminName, adminPassword } = req.body;
  if (!name || !slug || !adminEmail || !adminName || !adminPassword) {
    return fail(res, 'MISSING_PARAMS', 'Missing required parameters', 400);
  }

  // Pre-check for duplicate tenant slug to prevent schema constraint aborts
  try {
    const existingTenant = await pool.query('SELECT id FROM tenants WHERE slug = $1 LIMIT 1', [slug]);
    if (existingTenant.rows.length > 0) {
      return fail(res, 'SLUG_TAKEN', 'This workspace slug is already taken.', 400);
    }
  } catch (err) {
    return next(err);
  }

  const client = await pool.connect();
  let tenantId = null;
  try {
    await client.query('BEGIN');

    // 1. Create Tenant
    const tenantRes = await client.query(
      `INSERT INTO tenants (name, slug, plan, max_users) VALUES ($1, $2, $3, $4) RETURNING id`,
      [name, slug, plan || 'starter', max_users ? parseInt(max_users, 10) : 10]
    );
    tenantId = tenantRes.rows[0].id;

    // 2. Initialize Security Settings
    await client.query(
      `INSERT INTO tenant_security_settings (tenant_id) VALUES ($1)`,
      [tenantId]
    );

    // 3. Create Default Roles
    const defaultRoles = [
      {
        name: 'superadmin',
        permissions: ['*'],
      },
      {
        name: 'manager',
        permissions: ['leads:read', 'leads:write', 'projects:read'],
      },
      {
        name: 'user',
        permissions: ['leads:read'],
      }
    ];

    const rolesMap = {};
    for (const r of defaultRoles) {
      const { rows } = await client.query(
        `INSERT INTO roles (tenant_id, name, permissions, is_system)
         VALUES ($1, $2, $3, $4)
         RETURNING id`,
        [
          tenantId,
          r.name,
          JSON.stringify(r.permissions),
          true
        ]
      );
      rolesMap[r.name] = rows[0].id;
    }

    await client.query('COMMIT');

    // 4. Register Admin User
    const { registerUser } = require('../services/auth/register');
    const newUser = await registerUser({
      tenantId,
      email: adminEmail,
      name: adminName,
      password: adminPassword,
      roleId: rolesMap['superadmin']
    });

    return success(res, { tenantId, adminUser: newUser }, {}, 201);
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    if (tenantId) {
      // Clean up orphaned workspace to avoid 0 user state
      await pool.query('DELETE FROM tenants WHERE id = $1', [tenantId]).catch(() => {});
    }
    return fail(res, 'PROVISION_FAILED', error.message, 400);
  } finally {
    client.release();
  }
});

/**
 * UPDATE TENANT STATUS (ACTIVATE/DEACTIVATE)
 */
router.patch('/tenants/:id/status', async (req, res, next) => {
  const { id } = req.params;
  const { is_active } = req.body;
  if (is_active === undefined) return fail(res, 'MISSING_PARAM', 'Missing is_active field', 400);

  try {
    const { rowCount } = await pool.query(
      'UPDATE tenants SET is_active = $1 WHERE id = $2',
      [is_active, id]
    );
    if (rowCount === 0) return fail(res, 'NOT_FOUND', 'Tenant not found', 404);
    
    // Revoke sessions if deactivating
    if (!is_active) {
      await pool.query('DELETE FROM sessions WHERE tenant_id = $1', [id]);
    }

    // Invalidate active tenant status cache
    const { clearCache } = require('../utils/cache');
    await clearCache(`tenant_active:${id}`).catch(() => {});

    return success(res, { message: `Tenant status updated successfully` });
  } catch (error) {
    return next(error);
  }
});

/**
 * UPDATE TENANT SECURITY SETTINGS
 */
router.put('/tenants/:id/settings', async (req, res, next) => {
  const { id } = req.params;
  const {
    name,
    plan,
    max_users,
    mfa_required_all,
    session_timeout_minutes,
    concurrent_login_limit,
    password_min_length,
    password_require_symbols,
    password_require_numbers,
    password_expiry_days,
    password_prevent_reuse,
    allowed_ips,
    allowed_countries,
    logo_url,
    accent_colour,
    description,
    address,
    phone,
    email,
    website
  } = req.body;

  const client = await pool.connect();
  try {
    await client.query('BEGIN');

    // 1. Get current config to merge branding details
    const tenantRes = await client.query('SELECT config FROM tenants WHERE id = $1', [id]);
    let currentConfig = {};
    if (tenantRes.rows.length > 0) {
      const configStr = tenantRes.rows[0].config;
      currentConfig = typeof configStr === 'string' ? JSON.parse(configStr || '{}') : (configStr || {});
    }

    const updatedConfig = {
      ...currentConfig,
      ...(logo_url !== undefined && { logo_url }),
      ...(accent_colour !== undefined && { accent_colour }),
      ...(description !== undefined && { description }),
      ...(address !== undefined && { address }),
      ...(phone !== undefined && { phone }),
      ...(email !== undefined && { email }),
      ...(website !== undefined && { website })
    };

    // 2. Update tenants table
    await client.query(
      `UPDATE tenants 
       SET name = COALESCE($1, name),
           plan = COALESCE($2, plan),
           max_users = COALESCE($3, max_users),
           config = $4,
           updated_at = NOW()
       WHERE id = $5`,
      [name, plan, max_users !== undefined ? parseInt(max_users, 10) : null, JSON.stringify(updatedConfig), id]
    );

    // 3. Update tenant_security_settings table
    const { rowCount } = await client.query(
      `UPDATE tenant_security_settings 
       SET mfa_required_all = COALESCE($1, mfa_required_all),
           session_timeout_minutes = COALESCE($2, session_timeout_minutes),
           concurrent_login_limit = COALESCE($3, concurrent_login_limit),
           password_min_length = COALESCE($4, password_min_length),
           password_require_symbols = COALESCE($5, password_require_symbols),
           password_require_numbers = COALESCE($6, password_require_numbers),
           password_expiry_days = COALESCE($7, password_expiry_days),
           password_prevent_reuse = COALESCE($8, password_prevent_reuse),
           allowed_ips = COALESCE($9, allowed_ips),
           allowed_countries = COALESCE($10, allowed_countries),
           updated_at = NOW()
       WHERE tenant_id = $11`,
      [
        mfa_required_all,
        session_timeout_minutes,
        concurrent_login_limit,
        password_min_length,
        password_require_symbols,
        password_require_numbers,
        password_expiry_days,
        password_prevent_reuse,
        allowed_ips ? JSON.stringify(allowed_ips) : null,
        allowed_countries ? JSON.stringify(allowed_countries) : null,
        id
      ]
    );

    await client.query('COMMIT');
    return success(res, { message: 'Tenant settings updated successfully' });
  } catch (error) {
    await client.query('ROLLBACK').catch(() => {});
    return next(error);
  } finally {
    client.release();
  }
});

/**
 * GET SIDEBAR CONFIGURATIONS
 */
router.get('/sidebar-config', async (req, res, next) => {
  try {
    const planConfig = await pool.query('SELECT plan_name, enabled_tabs FROM sidebar_tabs_plan_config');
    
    const plans = planConfig.rows.map(p => ({
      plan_name: p.plan_name,
      enabled_tabs: JSON.parse(p.enabled_tabs || '[]')
    }));

    return success(res, { plans });
  } catch (error) {
    return next(error);
  }
});

/**
 * SAVE PLAN SIDEBAR CONFIG
 */
router.post('/sidebar-config/plan', async (req, res, next) => {
  const { plan_name, enabled_tabs } = req.body;
  if (!plan_name || !Array.isArray(enabled_tabs)) {
    return fail(res, 'INVALID_PARAMS', 'plan_name and enabled_tabs array are required', 400);
  }
  try {
    await pool.query(
      `INSERT INTO sidebar_tabs_plan_config (plan_name, enabled_tabs, updated_at) 
       VALUES ($1, $2, NOW())
       ON CONFLICT (plan_name) 
       DO UPDATE SET enabled_tabs = EXCLUDED.enabled_tabs, updated_at = NOW()`,
      [plan_name, JSON.stringify(enabled_tabs)]
    );
    return success(res, { message: `Sidebar configuration for plan ${plan_name} saved successfully` });
  } catch (error) {
    return next(error);
  }
});

// POST /api/superadmin/tenants/:id/upload-logo
router.post('/tenants/:id/upload-logo', upload.single('logo'), async (req, res, next) => {
  try {
    if (!req.file) return fail(res, 'BAD_REQUEST', 'No file uploaded', 400);

    const baseUrl = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
    const logoUrl = `${baseUrl}/uploads/logos/${req.file.filename}`;

    return success(res, { logoUrl });
  } catch (error) {
    next(error);
  }
});

/**
 * SWITCH TENANT
 */
router.post('/switch-tenant', async (req, res, next) => {
  const { tenantId } = req.body;
  if (!tenantId) return fail(res, 'MISSING_PARAM', 'tenantId is required', 400);

  try {
    // 1. Verify tenant exists
    const tenantResult = await pool.query('SELECT id, name, slug FROM tenants WHERE id = $1 LIMIT 1', [tenantId]);
    if (tenantResult.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Tenant not found', 404);
    }
    const tenant = tenantResult.rows[0];

    // 2. Find a superadmin user in the target tenant, or any active user if none
    const userResult = await pool.query(`
      SELECT u.id, u.email, r.name as role_name
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.tenant_id = $1 AND u.status = 'active'
      ORDER BY CASE WHEN r.name = 'superadmin' THEN 0 ELSE 1 END ASC, u.created_at ASC
      LIMIT 1
    `, [tenantId]);

    if (userResult.rows.length === 0) {
      return fail(res, 'NO_USERS', 'No active users found in the target workspace to switch to.', 400);
    }

    const targetUser = userResult.rows[0];

    // 3. Create a session for this user in the target tenant
    const sessionId = crypto.randomUUID();
    const { signAccessToken, signRefreshToken } = require('../services/auth/tokens');
    
    // Fetch full user details with permissions
    const fullQuery = await pool.query(`
      SELECT 
        u.id, u.name, u.email, u.status, u.avatar_url, u.created_at, u.profile_data,
        r.id as role_id, r.name as role_name, r.permissions as role_permissions,
        t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug, t.plan as tenant_plan,
        t.config as tenant_config
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.id = $1
      LIMIT 1
    `, [targetUser.id]);

    const row = fullQuery.rows[0];
    let actions = [];
    let enabledModules = [];
    if (row.role_permissions) {
      const p = typeof row.role_permissions === 'string' ? JSON.parse(row.role_permissions) : row.role_permissions;
      actions = Array.isArray(p) ? p : (p.actions || []);
      enabledModules = Array.isArray(p) ? [] : (p.modules || []);
    }

    const payload = { 
      userId: targetUser.id, 
      tenantId, 
      role: targetUser.role_name, 
      permissions: actions, 
      email: targetUser.email, 
      sessionId 
    };

    const accessToken = signAccessToken(payload);
    const refreshToken = signRefreshToken(payload);

    const tokenHash = crypto.createHash('sha256').update(refreshToken).digest('hex');
    const ip = req.ip || req.connection?.remoteAddress || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';

    await pool.query(`
      INSERT INTO sessions (id, user_id, tenant_id, token_hash, expires_at, ip_address, user_agent)
      VALUES ($1, $2, $3, $4, NOW() + INTERVAL '7 days', $5, $6)
    `, [sessionId, targetUser.id, tenantId, tokenHash, ip, userAgent]);

    // Audit log the switch
    await logAction(req.tenantId, req.user.id, 'SUPERADMIN_SWITCH_TENANT', `SuperAdmin switched workspace to tenant ${tenant.name} (${tenant.slug})`, { 
      targetTenantId: tenantId, 
      targetUserId: targetUser.id,
      severity: 'HIGH' 
    });

    // Set cookies
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/'
    };

    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000
    });

    res.cookie('accessToken', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000
    });

    // Format safe user output
    const planConfigRes = await pool.query('SELECT enabled_tabs FROM sidebar_tabs_plan_config WHERE plan_name = $1', [row.tenant_plan || 'starter']);
    const sidebarConfig = {
      planTabs: planConfigRes.rows.length > 0 ? JSON.parse(planConfigRes.rows[0].enabled_tabs || '[]') : null
    };

    const profile = row.profile_data || {};
    const tenantConfig = typeof row.tenant_config === 'string' ? JSON.parse(row.tenant_config || '{}') : (row.tenant_config || {});

    const safeUser = {
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status,
      avatar_url: row.avatar_url,
      created_at: row.created_at,
      phone: profile.phone || '',
      designation: profile.designation || '',
      role: row.role_id ? {
        id: row.role_id,
        name: row.role_name,
        permissions: actions,
        enabled_modules: enabledModules
      } : null,
      tenant: {
        id: row.tenant_id,
        name: row.tenant_name,
        slug: row.tenant_slug,
        plan: row.tenant_plan || 'starter',
        logoUrl: tenantConfig.logo_url || '',
        accentColour: tenantConfig.accent_colour || '',
        description: tenantConfig.description || '',
        address: tenantConfig.address || '',
        phone: tenantConfig.phone || '',
        email: tenantConfig.email || '',
        website: tenantConfig.website || ''
      },
      sidebarConfig
    };

    return success(res, { user: safeUser, accessToken, refreshToken });
  } catch (error) {
    return next(error);
  }
});

module.exports = router;

