const { fail } = require('../utils/response');

// In-memory store for abuse tracking (For production, use Redis)
// Format: { 'ip_address': { failures: number, lastFailureTime: number, blockedUntil: number } }
const abuseStore = new Map();

const ABUSE_THRESHOLD = 20; // Max failures before block
const ABUSE_WINDOW_MS = 60 * 1000; // 1 minute
const BLOCK_DURATION_MS = 5 * 60 * 1000; // 5 minutes

function abuseDetector(req, res, next) {
  const ip = req.ip || req.connection?.remoteAddress;
  if (!ip) return next();

  const now = Date.now();
  const record = abuseStore.get(ip) || { failures: 0, lastFailureTime: now, blockedUntil: 0 };

  // Check if IP is currently blocked
  if (record.blockedUntil > now) {
    return res.status(429).json(fail('Too many failed attempts. Your IP is temporarily blocked for security reasons.'));
  }

  // Clean up old failures if outside window
  if (now - record.lastFailureTime > ABUSE_WINDOW_MS) {
    record.failures = 0;
  }

  // Override res.send to intercept 401/403/404s
  const originalSend = res.send;
  res.send = function (body) {
    const statusCode = res.statusCode;
    
    // If it's an auth failure or not found (reconnaissance)
    if ([401, 403, 404].includes(statusCode)) {
      record.failures += 1;
      record.lastFailureTime = Date.now();

      if (record.failures >= ABUSE_THRESHOLD) {
        console.warn(`[SECURITY] Abuse detected from IP ${ip}. Blocking for 5 minutes.`);
        record.blockedUntil = Date.now() + BLOCK_DURATION_MS;
      }
      
      abuseStore.set(ip, record);
    } else if (statusCode >= 200 && statusCode < 300) {
      // On success, we can clear the failures
      if (record.failures > 0) {
        abuseStore.delete(ip);
      }
    }

    return originalSend.call(this, body);
  };

  next();
}

module.exports = abuseDetector;
