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

    const result = await pool.query('SELECT name, config FROM tenants WHERE id = $1', [tenantId]);
    if (result.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Tenant not found', 404);
    }

    const tenantName = result.rows[0].name;
    const configStr = result.rows[0].config;
    const config = typeof configStr === 'string' ? JSON.parse(configStr || '{}') : (configStr || {});
    return success(res, {
      companyName: tenantName,
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

    // Extract companyName if present
    const { companyName, ...configFields } = req.body;

    // Get current config
    const result = await pool.query('SELECT name, config FROM tenants WHERE id = $1', [tenantId]);
    if (result.rows.length === 0) {
      return fail(res, 'NOT_FOUND', 'Tenant not found', 404);
    }

    const currentConfigStr = result.rows[0].config;
    const currentConfig = typeof currentConfigStr === 'string' ? JSON.parse(currentConfigStr || '{}') : (currentConfigStr || {});

    // Merge new config
    const updatedConfig = {
      ...currentConfig,
      ...configFields
    };

    // Save back to db
    if (companyName) {
      await pool.query(
        'UPDATE tenants SET name = $1, config = $2, updated_at = NOW() WHERE id = $3',
        [companyName, JSON.stringify(updatedConfig), tenantId]
      );
    } else {
      await pool.query(
        'UPDATE tenants SET config = $1, updated_at = NOW() WHERE id = $2',
        [JSON.stringify(updatedConfig), tenantId]
      );
    }

    return success(res, {
      companyName: companyName || result.rows[0].name,
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

    return success(res, { logoUrl });
  } catch (error) {
    next(error);
  }
});

module.exports = router;
