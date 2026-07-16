const { getCache, setCache } = require('../utils/cache');

/**
 * Express middleware to cache GET requests in Redis.
 * @param {number} durationInSeconds - Cache TTL in seconds (default 900s / 15m)
 */
function cacheMiddleware(durationInSeconds = 900) {
  return async (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    const tenantId = req.tenantId || (req.user && req.user.tenantId) || 'global';
    // Use originalUrl to capture full path including query string
    const cacheKey = `api_cache:${tenantId}:${req.originalUrl}`;

    try {
      const cachedResponse = await getCache(cacheKey);
      if (cachedResponse) {
        return res.json(cachedResponse);
      }
    } catch (err) {
      console.warn('Cache lookup failed:', err);
      // Fall through on cache error
    }

    // Hijack res.json to capture and cache the output
    const originalJson = res.json.bind(res);
    res.json = (body) => {
      // Only cache successful responses
      if (res.statusCode >= 200 && res.statusCode < 300) {
        setCache(cacheKey, body, durationInSeconds).catch(err => {
          console.warn('Failed to set cache:', err);
        });
      }
      return originalJson(body);
    };

    next();
  };
}

module.exports = cacheMiddleware;
