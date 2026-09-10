const logger = require('../utils/logger');
const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const { registerUser } = require('../services/auth/register');
const { loginUser } = require('../services/auth/login');
const { refreshTokens } = require('../services/auth/refresh');
const { logoutUser } = require('../services/auth/logout');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');
const { ROLE_DEFAULTS, getRoleConfig } = require('../constants/roleDefaults');
const { PLAN_DEFAULTS } = require('../constants/permissions');

const router = express.Router();

const registerSchema = z.object({
  name: z.string().min(2, 'Name must be at least 2 characters'),
  email: z.string().email('Invalid email format'),
  password: z.string().min(8, 'Password must be at least 8 characters'),
  tenantSlug: z.string().min(1, 'Tenant slug is required')
});

router.post('/register', async (req, res, next) => {
  try {
    // 1. Validate body with zod
    const parsed = registerSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = new Error('Validation failed');
      error.isValidation = true;
      error.details = parsed.error.issues;
      return next(error);
    }

    const { name, email, password, tenantSlug } = parsed.data;
    const cleanEmail = (email || '').trim().toLowerCase();
    const rawSlug = (tenantSlug || '').trim();
    const normalizedSlug = rawSlug.toLowerCase().replace(/[\s_]+/g, '-');
    const noHyphenSlug = rawSlug.toLowerCase().replace(/[\s_-]+/g, '');

    // 2. Lookup tenant by slug or name
    const tenantResult = await pool.query(
      `SELECT id FROM tenants 
       WHERE LOWER(slug) = LOWER($1) 
          OR LOWER(slug) = LOWER($2) 
          OR LOWER(slug) = LOWER($3)
          OR LOWER(REPLACE(slug, '-', '')) = LOWER($3)
          OR LOWER(name) = LOWER($1)
          OR LOWER(REPLACE(name, ' ', '-')) = LOWER($2)
       LIMIT 1`,
      [rawSlug, normalizedSlug, noHyphenSlug]
    );

    if (tenantResult.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Tenant not found', 404);
    }

    const tenantId = tenantResult.rows[0].id;

    // Default role ID can be null for now, or you can implement logic to fetch a basic role
    const defaultRoleId = null;

    // 3. Call registerUser
    const user = await registerUser({ tenantId, email: cleanEmail, name: name.trim(), password, roleId: defaultRoleId });

    // 4. Return 201
    return success(res, { user }, {}, 201);
  } catch (error) {
    next(error);
  }
});

const loginSchema = z.object({
  email: z.string().email('Invalid email format'),
  password: z.string().min(1, 'Password is required'),
  tenantSlug: z.string().min(1, 'Tenant slug is required')
});

router.post('/login', async (req, res, next) => {
  try {
    // 1. Validate with zod
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      const error = new Error('Validation failed');
      error.isValidation = true;
      error.details = parsed.error.issues;
      return next(error);
    }

    const { email, password, tenantSlug } = parsed.data;
    const cleanEmail = (email || '').trim().toLowerCase();
    const rawSlug = (tenantSlug || '').trim();
    const normalizedSlug = rawSlug.toLowerCase().replace(/[\s_]+/g, '-');
    const noHyphenSlug = rawSlug.toLowerCase().replace(/[\s_-]+/g, '');

    // 2. Lookup tenant by slug or name
    const tenantResult = await pool.query(
      `SELECT id, is_active FROM tenants 
       WHERE LOWER(slug) = LOWER($1) 
          OR LOWER(slug) = LOWER($2) 
          OR LOWER(slug) = LOWER($3)
          OR LOWER(REPLACE(slug, '-', '')) = LOWER($3)
          OR LOWER(name) = LOWER($1)
          OR LOWER(REPLACE(name, ' ', '-')) = LOWER($2)
       LIMIT 1`,
      [rawSlug, normalizedSlug, noHyphenSlug]
    );

    if (tenantResult.rows.length === 0) {
      // Return 401 instead of 404 to avoid exposing whether a tenant exists for arbitrary slugs
      return fail(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const { id: tenantId, is_active } = tenantResult.rows[0];

    if (!is_active) {
      return fail(res, 'TENANT_DEACTIVATED', 'This workspace has been deactivated. Please contact support.', 403);
    }

    // 3. Call loginUser
    const ip = req.ip || req.connection?.remoteAddress || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const loginResult = await loginUser({
      email: cleanEmail,
      password,
      tenantId,
      ip,
      userAgent
    });

    if (loginResult.mfaRequired) {
      return success(res, {
        mfaRequired: true,
        tempToken: loginResult.tempToken,
        user: loginResult.user
      });
    }

    const { accessToken, refreshToken, user } = loginResult;

    // Set refreshToken and accessToken as httpOnly cookies
    const isProduction = process.env.NODE_ENV === 'production';
    
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/'
    };

    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.cookie('accessToken', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 minutes (or however long your token is valid)
    });

    // 4. Return 200 and expose tokens in JS payload for mobile apps
    return success(res, { user, accessToken, refreshToken });
  } catch (error) {
    next(error);
  }
});

router.post('/refresh', async (req, res, next) => {
  try {
    // 1. Extract refreshToken (body first, then cookie)
    const rawRefreshToken = req.body.refreshToken || (req.cookies && req.cookies.refreshToken);

    // 2. If missing -> 401
    if (!rawRefreshToken) {
      return fail(res, 'UNAUTHORIZED', 'No refresh token', 401);
    }

    // 3. Call refreshTokens
    const { accessToken, refreshToken } = await refreshTokens(rawRefreshToken);

    // 5. Set new refreshToken and accessToken cookies
    const isProduction = process.env.NODE_ENV === 'production';
    const cookieOptions = {
      httpOnly: true,
      secure: isProduction,
      sameSite: isProduction ? 'none' : 'lax',
      path: '/'
    };

    res.cookie('refreshToken', refreshToken, {
      ...cookieOptions,
      maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days
    });

    res.cookie('accessToken', accessToken, {
      ...cookieOptions,
      maxAge: 15 * 60 * 1000 // 15 minutes
    });

    // 4. Return 200
    return success(res, { accessToken, refreshToken });
  } catch (error) {
    res.clearCookie('refreshToken');
    res.clearCookie('accessToken');
    if (error.message === 'TENANT_DEACTIVATED' || error.code === 'TENANT_DEACTIVATED') {
      return fail(res, 'TENANT_DEACTIVATED', 'This workspace has been deactivated. Please contact support.', 403);
    }
    return fail(res, 'UNAUTHORIZED', 'Session expired. Please login again.', 401);
  }
});

router.post('/logout', authenticate, async (req, res) => {
  try {
    const rawRefreshToken = req.body.refreshToken || (req.cookies && req.cookies.refreshToken);

    if (rawRefreshToken) {
      await logoutUser(rawRefreshToken);
    }

    res.clearCookie('refreshToken');
    res.clearCookie('accessToken');
    return res.status(204).send();
  } catch (error) {
    logger.error('Logout Error:', error);
    res.clearCookie('refreshToken');
    res.clearCookie('accessToken');
    return res.status(204).send();
  }
});

const { verifyAccessToken, TokenExpiredError } = require('../services/auth/tokens');

router.get('/me', async (req, res, next) => {
  try {
    const authHeader = req.headers.authorization;
    let token = req.cookies?.accessToken;
    if (authHeader && authHeader.startsWith('Bearer ')) {
      token = authHeader.split(' ')[1];
    }

    if (!token) {
      return fail(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }

    let decoded;
    try {
      decoded = verifyAccessToken(token);
    } catch (e) {
      return fail(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }

    const userId = decoded.id || decoded.userId;

    const query = `
      SELECT 
        u.id, u.name, u.email, u.status, u.avatar_url, u.created_at, u.profile_data,
        r.id as role_id, r.name as role_name, r.permissions as role_permissions,
        t.id as tenant_id, t.name as tenant_name, t.slug as tenant_slug, t.plan as tenant_plan,
        t.config as tenant_config, t.is_active as tenant_is_active
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      LEFT JOIN tenants t ON u.tenant_id = t.id
      WHERE u.id = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return fail(res, 'UNAUTHORIZED', 'Not authenticated', 401);
    }

    const row = result.rows[0];

    if (row.tenant_is_active === false) {
      return fail(res, 'TENANT_DEACTIVATED', 'This workspace has been deactivated. Please contact support.', 403);
    }

    let actions = [];
    let enabledModules = [];
    let dataScopes = {};
    let fieldPermissions = {};
    let pagePermissions = {};
    let roleName = row.role_name || (row.role_id ? 'Team Member' : 'Designer');
    if (row.role_permissions) {
      const p = typeof row.role_permissions === 'string' ? JSON.parse(row.role_permissions) : row.role_permissions;
      actions = Array.isArray(p) ? p : (p.actions || []);
      enabledModules = Array.isArray(p) ? [] : (p.modules || []);
      dataScopes = Array.isArray(p) ? {} : (p.scopes || {});
      fieldPermissions = Array.isArray(p) ? {} : (p.fields || {});
      pagePermissions = Array.isArray(p) ? {} : (p.pages || {});
    }

    if (!row.role_permissions) {
      const roleConfig = getRoleConfig(roleName) || ROLE_DEFAULTS['Designer'];
      if (roleConfig) {
        if (actions.length === 0) actions = roleConfig.permissions || [];
        if (enabledModules.length === 0) enabledModules = roleConfig.enabled_modules || [];
        if (Object.keys(dataScopes).length === 0) dataScopes = roleConfig.data_scopes || {};
        if (Object.keys(fieldPermissions).length === 0) fieldPermissions = roleConfig.field_permissions || {};
        if (Object.keys(pagePermissions).length === 0) pagePermissions = roleConfig.page_permissions || {};
      }
    }

    const planName = (row.tenant_plan || 'starter').toLowerCase();
    let enabledTabs = null;
    try {
      const planConfigRes = await pool.query('SELECT enabled_tabs FROM sidebar_tabs_plan_config WHERE LOWER(plan_name) = LOWER($1)', [planName]);
      if (planConfigRes.rows.length > 0 && planConfigRes.rows[0].enabled_tabs) {
        const raw = planConfigRes.rows[0].enabled_tabs;
        enabledTabs = typeof raw === 'string' ? JSON.parse(raw) : raw;
      }
    } catch (e) {}

    if (!enabledTabs || !Array.isArray(enabledTabs) || enabledTabs.length === 0) {
      enabledTabs = PLAN_DEFAULTS[planName] || PLAN_DEFAULTS.starter;
    }

    const sidebarConfig = {
      planTabs: enabledTabs
    };

    const profile = row.profile_data || {};
    const tenantConfig = typeof row.tenant_config === 'string' ? JSON.parse(row.tenant_config || '{}') : (row.tenant_config || {});

    const user = {
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status,
      avatar_url: row.avatar_url,
      created_at: row.created_at,
      phone: profile.phone || '',
      designation: profile.designation || '',
      role: {
        id: row.role_id || 'superadmin',
        name: roleName,
        permissions: actions,
        enabled_modules: enabledModules,
        data_scopes: dataScopes,
        field_permissions: fieldPermissions,
        page_permissions: pagePermissions
      },
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

    return success(res, { user });
  } catch (error) {
    logger.error('[AUTH_LOGIN_ERROR]', error);
    next(error);
  }
});

router.get('/sidebar-config', authenticate, async (req, res, next) => {
  try {
    const tenantRes = await pool.query('SELECT plan FROM tenants WHERE id = $1', [req.tenantId]);
    const tenantPlan = (tenantRes.rows[0]?.plan || 'starter').toLowerCase();

    const planConfigRes = await pool.query('SELECT enabled_tabs FROM sidebar_tabs_plan_config WHERE LOWER(plan_name) = LOWER($1)', [tenantPlan]);
    let enabledTabs = null;
    if (planConfigRes.rows.length > 0 && planConfigRes.rows[0].enabled_tabs) {
      const raw = planConfigRes.rows[0].enabled_tabs;
      enabledTabs = typeof raw === 'string' ? JSON.parse(raw) : raw;
    }

    if (!enabledTabs || !Array.isArray(enabledTabs) || enabledTabs.length === 0) {
      enabledTabs = PLAN_DEFAULTS[tenantPlan] || PLAN_DEFAULTS.starter;
    }

    return success(res, { planTabs: enabledTabs, plan: tenantPlan });
  } catch (error) {
    return next(error);
  }
});

router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const tenantId = req.tenantId;

    const userQuery = await pool.query(`
      SELECT u.profile_data, r.name as role_name 
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1 AND u.tenant_id = $2
    `, [userId, tenantId]);

    if (userQuery.rows.length === 0) {
      return res.status(404).json(fail('User not found'));
    }

    const roleName = userQuery.rows[0].role_name || '';
    const isSuperAdmin = roleName.toLowerCase() === 'superadmin';
    const currentProfileData = userQuery.rows[0].profile_data || {};

    const { name, avatar_url, email, phone, designation } = req.body;

    const updates = [];
    const params = [userId, tenantId];

    if (name) {
      params.push(name);
      updates.push(`name = $${params.length}`);
    }
    if (avatar_url !== undefined) {
      params.push(avatar_url);
      updates.push(`avatar_url = $${params.length}`);
    }
    if (email && isSuperAdmin) {
      params.push(email);
      updates.push(`email = $${params.length}`);
    }

    let profileUpdated = false;
    if (phone !== undefined) {
      currentProfileData.phone = phone;
      profileUpdated = true;
    }
    if (designation !== undefined) {
      currentProfileData.designation = designation;
      profileUpdated = true;
    }

    if (profileUpdated) {
      params.push(JSON.stringify(currentProfileData));
      updates.push(`profile_data = $${params.length}`);
    }

    if (updates.length === 0) {
      return res.status(400).json(fail('No fields to update'));
    }

    updates.push('updated_at = NOW()');

    const result = await pool.query(`
      UPDATE users SET ${updates.join(', ')}
      WHERE id = $1 AND tenant_id = $2
      RETURNING *
    `, params);

    if (result.rows.length === 0) {
      return res.status(404).json(fail('User not found'));
    }

    const fullQuery = await pool.query(`
      SELECT 
        u.id, u.name, u.email, u.status, u.avatar_url, u.created_at, u.profile_data,
        r.id as role_id, r.name as role_name, r.permissions as role_permissions
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
      LIMIT 1
    `, [userId]);

    const updatedRow = fullQuery.rows[0];
    let actions = [];
    let enabledModules = [];
    let dataScopes = {};
    let fieldPermissions = {};
    let pagePermissions = {};
    if (updatedRow.role_permissions) {
      const p = typeof updatedRow.role_permissions === 'string' ? JSON.parse(updatedRow.role_permissions) : updatedRow.role_permissions;
      actions = Array.isArray(p) ? p : (p.actions || []);
      enabledModules = Array.isArray(p) ? [] : (p.modules || []);
      dataScopes = Array.isArray(p) ? {} : (p.scopes || {});
      fieldPermissions = Array.isArray(p) ? {} : (p.fields || {});
      pagePermissions = Array.isArray(p) ? {} : (p.pages || {});
    }

    const finalProfile = updatedRow.profile_data || {};
    const safeUser = {
      id: updatedRow.id,
      name: updatedRow.name,
      email: updatedRow.email,
      status: updatedRow.status,
      avatar_url: updatedRow.avatar_url,
      created_at: updatedRow.created_at,
      phone: finalProfile.phone || '',
      designation: finalProfile.designation || '',
      role: updatedRow.role_id ? {
        id: updatedRow.role_id,
        name: updatedRow.role_name,
        permissions: actions,
        enabled_modules: enabledModules,
        data_scopes: dataScopes,
        field_permissions: fieldPermissions,
        page_permissions: pagePermissions
      } : null
    };

    return success(res, safeUser);
  } catch (error) {
    next(error);
  }
});

const bcrypt = require('bcryptjs');

router.post('/change-password', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const tenantId = req.tenantId;
    const { currentPassword, newPassword } = req.body;

    if (!newPassword || newPassword.length < 8) {
      return res.status(400).json(fail('New password must be at least 8 characters long'));
    }

    const userRes = await pool.query('SELECT password_hash FROM users WHERE id = $1 AND tenant_id = $2', [userId, tenantId]);
    if (userRes.rows.length === 0) {
      return res.status(404).json(fail('User not found'));
    }

    const user = userRes.rows[0];
    const isValid = await bcrypt.compare(currentPassword, user.password_hash);
    
    if (!isValid) {
      return res.status(401).json(fail('WRONG_PASSWORD'));
    }

    const newHash = await bcrypt.hash(newPassword, 10);
    
    await pool.query('UPDATE users SET password_hash = $1, updated_at = NOW() WHERE id = $2 AND tenant_id = $3', [newHash, userId, tenantId]);
    const delRes = await pool.query('DELETE FROM sessions WHERE user_id = $1 AND tenant_id = $2 RETURNING id', [userId, tenantId]);
    const { clearCache } = require('../utils/cache');
    for (const row of delRes.rows) {
      await clearCache(`session:${row.id}`).catch(() => {});
    }
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.delete('/sessions', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const tenantId = req.tenantId;

    const delRes = await pool.query('DELETE FROM sessions WHERE user_id = $1 AND tenant_id = $2 RETURNING id', [userId, tenantId]);
    const { clearCache } = require('../utils/cache');
    for (const row of delRes.rows) {
      await clearCache(`session:${row.id}`).catch(() => {});
    }
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

// Mock Password Reset Trigger
router.post('/reset-password-request', async (req, res) => {
  const { email, tenantSlug } = req.body;
  if (!email || !tenantSlug) return fail(res, 'VALIDATION_ERROR', 'Email and tenantSlug required', 400);
  
  try {
    const tenantResult = await pool.query('SELECT id FROM tenants WHERE slug = $1 LIMIT 1', [tenantSlug]);
    if (tenantResult.rows.length === 0) return success(res, { message: 'If email exists, reset sent' });
    
    const userResult = await pool.query('SELECT id, name FROM users WHERE email=$1 AND tenant_id=$2 LIMIT 1', [email, tenantResult.rows[0].id]);
    if (userResult.rows.length > 0) {
      const u = userResult.rows[0];
      const resetUrl = `http://localhost:5173/reset-password?token=mock_token`;
      queueEmail(tenantResult.rows[0].id, u.id, email, 'Password Reset Request', 'password_reset', { name: u.name, resetUrl });
    }
    return success(res, { message: 'If email exists, reset sent' });
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Error processing reset', 500);
  }
});

// Mock Password Change Trigger
router.post('/change-password-mock', authenticate, async (req, res) => {
  const { newPassword } = req.body;
  if (!newPassword) return fail(res, 'VALIDATION_ERROR', 'newPassword required', 400);
  try {
    const userId = req.user.id || req.user.userId;
    const userResult = await pool.query('SELECT name, email FROM users WHERE id=$1 AND tenant_id=$2', [userId, req.tenantId]);
    if (userResult.rows.length > 0) {
      queueEmail(req.tenantId, userId, userResult.rows[0].email, 'Password Changed', 'password_changed', { name: userResult.rows[0].name });
    }
    return success(res, { message: 'Password changed successfully (mock)' });
  } catch (error) {
    return fail(res, 'INTERNAL_ERROR', 'Error changing password', 500);
  }
});

const { validatePasswordPolicy, hashPassword, recordPasswordChange } = require('../services/auth/password');
router.post('/force-reset-password', async (req, res) => {
  const { userId, newPassword } = req.body;
  if (!userId || !newPassword) return res.status(400).json({ success: false, message: 'Invalid payload' });
  try {
    const userRes = await pool.query('SELECT tenant_id FROM users WHERE id = $1', [userId]);
    if (userRes.rowCount === 0) return res.status(404).json({ success: false, message: 'User not found' });
    const tenantId = userRes.rows[0].tenant_id;
    
    await validatePasswordPolicy(newPassword, tenantId, userId);
    const passwordHash = await hashPassword(newPassword);
    
    await pool.query('UPDATE users SET password_hash = $1 WHERE id = $2', [passwordHash, userId]);
    await recordPasswordChange(userId, passwordHash);
    
    return res.json({ success: true, message: 'Password updated successfully' });
  } catch (error) {
    return res.status(400).json({ success: false, message: error.message });
  }
});

module.exports = router;
