const express = require('express');
const pool = require('../../db/pool');
const authenticate = require('../../middleware/authenticate');
const authorize = require('../../middleware/authorize');
const { success, fail } = require('../../utils/response');
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

router.use(authenticate);

// GET /api/config/tenant-settings
router.get('/', async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    const result = await pool.query('SELECT name, slug, config FROM tenants WHERE id = $1', [tenantId]);
    if (result.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Tenant not found', 404);
    }

    const tenantName = result.rows[0].name;
    const tenantSlug = result.rows[0].slug;
    const configStr = result.rows[0].config;
    const config = typeof configStr === 'string' ? JSON.parse(configStr || '{}') : (configStr || {});
    return success(res, {
      companyName: tenantName,
      slug: tenantSlug,
      ...config
    });
  } catch (error) {
    next(error);
  }
});

// PATCH /api/config/tenant-settings
router.patch('/', authorize('config:manage'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);

    // Enterprise Finance Validations
    const perms = req.user.permissions || [];
    const isSuper = perms.includes('*');
    if (req.body.gst_settings && !isSuper && !perms.includes('finance:manage_gst')) {
      return fail(res, 'FORBIDDEN', 'Lacks finance:manage_gst permission', 403);
    }
    if (req.body.tax_settings && !isSuper && !perms.includes('finance:manage_taxes')) {
      return fail(res, 'FORBIDDEN', 'Lacks finance:manage_taxes permission', 403);
    }

    // Extract companyName and slug if present
    const { companyName, slug, ...configFields } = req.body;

    if (configFields.logoUrl !== undefined && configFields.logo_url === undefined) {
      configFields.logo_url = configFields.logoUrl;
    }
    if (configFields.accentColour !== undefined && configFields.accent_colour === undefined) {
      configFields.accent_colour = configFields.accentColour;
    }

    // Get current config and slug
    const result = await pool.query('SELECT name, slug, config FROM tenants WHERE id = $1', [tenantId]);
    if (result.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Tenant not found', 404);
    }

    const currentSlug = result.rows[0].slug;
    let targetSlug = currentSlug;

    if (slug !== undefined && slug !== null && String(slug).trim().length > 0) {
      const cleanSlug = String(slug).trim().toLowerCase().replace(/[\s_]+/g, '-');
      if (cleanSlug.length < 2) {
        return fail(res, 'INVALID_SLUG', 'Workspace slug must be at least 2 characters long.', 400);
      }
      if (!/^[a-z0-9-]+$/.test(cleanSlug)) {
        return fail(res, 'INVALID_SLUG', 'Workspace slug may only contain lowercase letters, numbers, and hyphens.', 400);
      }
      if (currentSlug === 'demo' && cleanSlug !== 'demo') {
        return fail(res, 'ROOT_SLUG_IMMUTABLE', 'The root demo workspace slug cannot be modified.', 400);
      }
      if (cleanSlug !== currentSlug) {
        const slugCheck = await pool.query('SELECT id FROM tenants WHERE slug = $1 AND id != $2 LIMIT 1', [cleanSlug, tenantId]);
        if (slugCheck.rows.length > 0) {
          return fail(res, 'SLUG_TAKEN', 'This workspace slug is already taken by another workspace.', 400);
        }
        targetSlug = cleanSlug;
      }
    }

    const currentConfigStr = result.rows[0].config;
    const currentConfig = typeof currentConfigStr === 'string' ? JSON.parse(currentConfigStr || '{}') : (currentConfigStr || {});

    // Merge new config
    const updatedConfig = {
      ...currentConfig,
      ...configFields
    };

    // Save back to db
    await pool.query(
      'UPDATE tenants SET name = COALESCE($1, name), slug = $2, config = $3, updated_at = NOW() WHERE id = $4',
      [companyName || result.rows[0].name, targetSlug, JSON.stringify(updatedConfig), tenantId]
    );

    return success(res, {
      companyName: companyName || result.rows[0].name,
      slug: targetSlug,
      ...updatedConfig
    });
  } catch (error) {
    next(error);
  }
});

// POST /api/config/tenant-settings/upload-logo
router.post('/upload-logo', upload.single('logo'), async (req, res, next) => {
  try {
    const tenantId = req.tenantId || (req.user && req.user.tenantId);
    if (!tenantId) return fail(res, 'UNAUTHORIZED', 'Tenant context missing', 401);
    if (!req.file) return fail(res, 'BAD_REQUEST', 'No file uploaded', 400);

    const baseUrl = process.env.API_URL || `${req.protocol}://${req.get('host')}`;
    const logoUrl = `${baseUrl}/uploads/logos/${req.file.filename}`;

    try {
      const tenantRes = await pool.query('SELECT config FROM tenants WHERE id = $1', [tenantId]);
      if (tenantRes.rows.length > 0) {
        const currentConfigStr = tenantRes.rows[0].config;
        const currentConfig = typeof currentConfigStr === 'string' ? JSON.parse(currentConfigStr || '{}') : (currentConfigStr || {});
        currentConfig.logo_url = logoUrl;
        await pool.query('UPDATE tenants SET config = $1, updated_at = NOW() WHERE id = $2', [JSON.stringify(currentConfig), tenantId]);
      }
    } catch (dbErr) {
      console.warn('Failed to auto-update tenant config with uploaded logo:', dbErr);
    }

    return success(res, { logoUrl, logo_url: logoUrl });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
