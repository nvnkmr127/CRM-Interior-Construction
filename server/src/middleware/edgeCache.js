/**
 * Middleware to enable edge caching for CDNs (like Cloudflare, CloudFront)
 * This should ONLY be applied to public, non-sensitive, or tenant-scoped static endpoints
 * where stale data is acceptable for the max-age duration.
 * 
 * @param {number} maxAgeSeconds Local browser cache duration
 * @param {number} sMaxAgeSeconds CDN edge cache duration
 */
function edgeCache(maxAgeSeconds = 60, sMaxAgeSeconds = 300) {
  return (req, res, next) => {
    // Only cache GET requests
    if (req.method !== 'GET') {
      return next();
    }

    // Set Cache-Control header
    // public: Allows intermediate proxies/CDNs to cache
    // max-age: Browser cache time
    // s-maxage: CDN cache time
    // stale-while-revalidate: Serve stale content while fetching fresh content in background
    res.setHeader(
      'Cache-Control', 
      `public, max-age=${maxAgeSeconds}, s-maxage=${sMaxAgeSeconds}, stale-while-revalidate=${Math.floor(sMaxAgeSeconds / 2)}`
    );

    // If you use an ETag, you can optionally validate it here to return 304 Not Modified
    
    next();
  };
}

module.exports = edgeCache;
