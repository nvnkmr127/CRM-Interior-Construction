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

exports.getTokens = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const tokens = await apiKeyRepository.getKeys(tenantId);
    // Parse permissions for frontend
    const parsedTokens = tokens.map(t => ({
      ...t,
      permissions: typeof t.permissions === 'string' ? JSON.parse(t.permissions) : t.permissions
    }));
    return success(res, parsedTokens);
  } catch (error) {
    next(error);
  }
};

exports.createToken = async (req, res, next) => {
  try {
    const { tenantId, userId } = getTenantAndUser(req);
    const { name, description, permissions } = req.body;
    
    if (!name) return fail(res, 'BAD_REQUEST', 'Token name is required', 400);

    const rawSecret = generateSecret();
    const secretHash = hashApiKey(rawSecret);

    const token = await apiKeyRepository.createKey(tenantId, userId, {
      name,
      description,
      permissions,
      secretHash
    });

    token.permissions = typeof token.permissions === 'string' ? JSON.parse(token.permissions) : token.permissions;

    // Return the raw secret ONLY ONCE
    return success(res, { token, rawSecret }, 201);
  } catch (error) {
    next(error);
  }
};

exports.updateToken = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id } = req.params;
    const { name, description, permissions, status } = req.body;

    const token = await apiKeyRepository.updateKey(tenantId, id, { name, description, permissions, status });
    if (!token) return fail(res, 'NOT_FOUND', 'API Token not found', 404);

    token.permissions = typeof token.permissions === 'string' ? JSON.parse(token.permissions) : token.permissions;
    return success(res, token);
  } catch (error) {
    next(error);
  }
};

exports.regenerateToken = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id } = req.params;

    const rawSecret = generateSecret();
    const secretHash = hashApiKey(rawSecret);

    const token = await apiKeyRepository.updateKeySecret(tenantId, id, secretHash);
    if (!token) return fail(res, 'NOT_FOUND', 'API Token not found', 404);

    // Return the raw secret ONLY ONCE
    return success(res, { rawSecret });
  } catch (error) {
    next(error);
  }
};

exports.deleteToken = async (req, res, next) => {
  try {
    const { tenantId } = getTenantAndUser(req);
    const { id } = req.params;
    await apiKeyRepository.deleteKey(tenantId, id);
    return success(res, { message: 'API Token deleted successfully' });
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
