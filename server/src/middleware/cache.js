const { getCache, setCache } = require('../utils/cache');

const cacheResponse = (durationInSeconds) => {
  return async (req, res, next) => {
    try {
      const tenantId = req.tenantId || (req.user && req.user.tenantId) || 'sys';
      const userId = req.user ? req.user.id || req.user.userId : 'anon';
      
      // Use query params and path for cache key
      const key = `cache:${tenantId}:${userId}:${req.originalUrl}`;
      
      const cachedData = await getCache(key);
      if (cachedData) {
        return res.json(cachedData);
      }
      
      // Intercept res.json to cache the response body
      const originalJson = res.json;
      res.json = function(body) {
        // Restore original to prevent double caching issues
        res.json = originalJson;
        
        // Cache the response asynchronously
        setCache(key, body, durationInSeconds).catch(err => console.error('Cache set error', err));
        
        return originalJson.call(this, body);
      };
      
      next();
    } catch (error) {
      console.error('Cache middleware error:', error);
      next(); // Fail open if cache errors out
    }
  };
};

module.exports = {
  cacheResponse
};
