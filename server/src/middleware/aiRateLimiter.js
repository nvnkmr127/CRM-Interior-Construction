const { rateLimit, default: defaultRateLimit } = require('express-rate-limit');
const { fail } = require('../utils/response');

const rateLimitFn = rateLimit || defaultRateLimit || require('express-rate-limit');

// Rate limiting for AI endpoints per Tenant and Lead
const aiRateLimiter = rateLimitFn({
  windowMs: 15 * 60 * 1000, // 15 minutes window
  max: 15, // limit each lead to 15 AI requests per 15 minutes
  standardHeaders: true,
  legacyHeaders: false,
  handler: (req, res) => {
    res.status(429).json(fail('Too many AI requests for this lead. Please wait a moment and try again.'));
  },
  keyGenerator: (req, res) => {
    // Identity is tied to the tenant and the lead being queried
    const tenantId = req.user ? req.user.tenantId : 'unknown_tenant';
    const leadId = req.params.id || req.body.leadId || 'general';
    return `ai_limit_${tenantId}_${leadId}`;
  }
});

module.exports = aiRateLimiter;
