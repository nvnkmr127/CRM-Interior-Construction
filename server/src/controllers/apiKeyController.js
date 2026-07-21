const crypto = require('crypto');
const apiKeyRepository = require('../repositories/apiKeyRepository');
const { success, fail } = require('../utils/response');
const { hashApiKey } = require('../middlewares/apiAuth');

function getTenantAndUser(req) {
  return {
    tenantId: req.tenantId || (req.user && req.user.tenantId),
    userId: req.userId || (req.user && req.user.id)
  };
}

function generateSecret() {
  return 'sk_live_' + crypto.randomBytes(32).toString('base64url');
}

exports.getKeys = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const keys = await apiKeyRepository.getKeys(tenantId);
    // Parse permissions for frontend
    const parsedKeys = keys.map(k => ({
      ...k,
      permissions: typeof k.permissions === 'string' ? JSON.parse(k.permissions) : k.permissions
    }));
    return success(res, parsedKeys);
  } catch (error) {
    next(error);
  }
};

exports.createKey = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const { name, description, permissions } = req.body;
    
    if (!name) return fail(res, 'BAD_REQUEST', 'Key name is required', 400);

    const rawSecret = generateSecret();
    const secretHash = hashApiKey(rawSecret);

    const key = await apiKeyRepository.createKey(tenantId, userId, {
      name,
      description,
      permissions,
      secretHash
    });

    key.permissions = typeof key.permissions === 'string' ? JSON.parse(key.permissions) : key.permissions;

    // Return the raw secret ONLY ONCE
    return success(res, { key, rawSecret }, 201);
  } catch (error) {
    next(error);
  }
};

exports.updateKey = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id } = req.params;
    const { name, description, permissions, status } = req.body;

    const key = await apiKeyRepository.updateKey(tenantId, id, { name, description, permissions, status });
    if (!key) return fail(res, 'NOT_FOUND', 'API Key not found', 404);

    key.permissions = typeof key.permissions === 'string' ? JSON.parse(key.permissions) : key.permissions;
    return success(res, key);
  } catch (error) {
    next(error);
  }
};

exports.regenerateKey = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id } = req.params;

    const rawSecret = generateSecret();
    const secretHash = hashApiKey(rawSecret);

    const key = await apiKeyRepository.updateKeySecret(tenantId, id, secretHash);
    if (!key) return fail(res, 'NOT_FOUND', 'API Key not found', 404);

    // Return the raw secret ONLY ONCE
    return success(res, { rawSecret });
  } catch (error) {
    next(error);
  }
};

exports.deleteKey = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id } = req.params;
    await apiKeyRepository.deleteKey(tenantId, id);
    return success(res, { message: 'API Key deleted successfully' });
  } catch (error) {
    next(error);
  }
};

exports.getDashboardStats = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const stats = await apiKeyRepository.getDashboardStats(tenantId);
    return success(res, stats);
  } catch (error) {
    next(error);
  }
};
