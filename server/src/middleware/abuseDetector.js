const { fail } = require('../utils/response');
const { getCache, setCache } = require('../utils/cache');

// In-memory store fallback for abuse tracking if Redis is disabled
const abuseStore = new Map();

const isDev = process.env.NODE_ENV !== 'production';
const ABUSE_THRESHOLD = isDev ? 1000 : 50; // Max failures before block
const ABUSE_WINDOW_MS = 60 * 1000; // 1 minute
const BLOCK_DURATION_SEC = 5 * 60; // 5 minutes in seconds

async function abuseDetector(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress;
  if (!ip) return next();

  const now = Date.now();
  const redisKey = `abuse_ip:${ip}`;

  // 1. Check current status
  let record;
  try {
    record = await getCache(redisKey);
  } catch (err) {
    console.error('Redis error in abuse detector', err);
  }

  // Fallback to memory if no redis record is found but it's in memory
  if (!record && abuseStore.has(ip)) {
    record = abuseStore.get(ip);
  }

  if (!record) {
    record = { failures: 0, lastFailureTime: now, blockedUntil: 0 };
  }

  // Check if IP is currently blocked
  if (record.blockedUntil > now) {
    return fail(res, 'RATE_LIMITED', 'Too many failed attempts. Your IP is temporarily blocked for security reasons.', 429);
  }

  // Clean up old failures if outside window
  if (now - record.lastFailureTime > ABUSE_WINDOW_MS) {
    record.failures = 0;
  }

  // 2. Intercept response
  const originalSend = res.send;
  res.send = function (body) {
    const statusCode = res.statusCode;
    
    // If it's an auth failure or not found (reconnaissance)
    if ([401, 403, 404].includes(statusCode)) {
      record.failures += 1;
      record.lastFailureTime = Date.now();

      if (record.failures >= ABUSE_THRESHOLD) {
        console.warn(`[SECURITY] Abuse detected from IP ${ip}. Blocking for 5 minutes.`);
        record.blockedUntil = Date.now() + (BLOCK_DURATION_SEC * 1000);
      }
      
      // Save state asynchronously (don't block the response)
      setCache(redisKey, record, BLOCK_DURATION_SEC + 60).catch(_err => {
        // Fallback to memory
        abuseStore.set(ip, record);
      });
      // Always set memory fallback just in case
      abuseStore.set(ip, record);
      
    } else if (statusCode >= 200 && statusCode < 300) {
      // On success, we can clear the failures
      if (record.failures > 0) {
        record.failures = 0;
        record.blockedUntil = 0;
        setCache(redisKey, record, 60).catch(() => {});
        abuseStore.delete(ip);
      }
    }

    return originalSend.call(this, body);
  };

  next();
}

module.exports = abuseDetector;
