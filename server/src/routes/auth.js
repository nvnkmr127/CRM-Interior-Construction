const express = require('express');
const { z } = require('zod');
const pool = require('../db/pool');
const { registerUser } = require('../services/auth/register');
const { loginUser } = require('../services/auth/login');
const { refreshTokens } = require('../services/auth/refresh');
const { logoutUser } = require('../services/auth/logout');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');

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
      const err = new Error('Validation failed');
      err.isValidation = true;
      err.details = parsed.error.issues;
      return next(err);
    }

    const { name, email, password, tenantSlug } = parsed.data;

    // 2. Lookup tenant by slug
    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE slug = $1 LIMIT 1',
      [tenantSlug]
    );

    if (tenantResult.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Tenant not found', 404);
    }

    const tenantId = tenantResult.rows[0].id;

    // Default role ID can be null for now, or you can implement logic to fetch a basic role
    const defaultRoleId = null;

    // 3. Call registerUser
    const user = await registerUser({ tenantId, email, name, password, roleId: defaultRoleId });

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
      const err = new Error('Validation failed');
      err.isValidation = true;
      err.details = parsed.error.issues;
      return next(err);
    }

    const { email, password, tenantSlug } = parsed.data;

    // 2. Lookup tenant by slug -> tenantId
    const tenantResult = await pool.query(
      'SELECT id FROM tenants WHERE slug = $1 LIMIT 1',
      [tenantSlug]
    );

    if (tenantResult.rows.length === 0) {
      // Return 401 instead of 404 to avoid exposing whether a tenant exists for arbitrary slugs
      return fail(res, 'INVALID_CREDENTIALS', 'Invalid email or password', 401);
    }

    const tenantId = tenantResult.rows[0].id;

    // 3. Call loginUser
    const ip = req.ip || req.connection?.remoteAddress || 'Unknown';
    const userAgent = req.headers['user-agent'] || 'Unknown';
    const loginResult = await loginUser({
      email,
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
      sameSite: 'strict',
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
      sameSite: 'strict',
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
    return success(res, {});
  } catch (error) {
    // If the refresh service throws an error (e.g., TOKEN_INVALID), we can treat it as UNAUTHORIZED
    // Alternatively, let the global handler catch named errors. The global handler will throw 500
    // for unknown ones, but the user requested: 401 { error: 'Session expired. Please login again.' }
    // Let's explicitly format it here to fulfill that specific prompt requirement.
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
    console.error('Logout Error:', error);
    res.clearCookie('refreshToken');
    res.clearCookie('accessToken');
    return res.status(204).send();
  }
});

router.get('/me', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.userId;

    const query = `
      SELECT 
        u.id, u.name, u.email, u.status, u.avatar_url, u.created_at,
        r.id as role_id, r.name as role_name, r.permissions as role_permissions
      FROM users u
      LEFT JOIN roles r ON u.role_id = r.id
      WHERE u.id = $1
      LIMIT 1
    `;

    const result = await pool.query(query, [userId]);

    if (result.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'User not found', 404);
    }

    const row = result.rows[0];

    const user = {
      id: row.id,
      name: row.name,
      email: row.email,
      status: row.status,
      avatar_url: row.avatar_url,
      created_at: row.created_at,
      role: row.role_id ? {
        id: row.role_id,
        name: row.role_name,
        permissions: row.role_permissions
      } : null
    };

    // Attach permissions to req.user for downstream use if needed
    req.user.permissions = row.role_permissions || [];

    return success(res, { user });
  } catch (error) {
    next(error);
  }
});

router.patch('/me', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const tenantId = req.tenantId;
    const { name, avatar_url } = req.body;

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

    const { password_hash: _password_hash, ...safeUser } = result.rows[0];
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
    await pool.query('DELETE FROM sessions WHERE user_id = $1 AND tenant_id = $2', [userId, tenantId]);
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

router.delete('/sessions', authenticate, async (req, res, next) => {
  try {
    const userId = req.user.id || req.user.userId;
    const tenantId = req.tenantId;

    await pool.query('DELETE FROM sessions WHERE user_id = $1 AND tenant_id = $2', [userId, tenantId]);
    
    res.status(204).send();
  } catch (error) {
    next(error);
  }
});

module.exports = router;
