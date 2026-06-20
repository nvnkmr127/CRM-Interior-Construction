const pool = require('../db/pool');

/**
 * Utility to write an audit log entry.
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @param {string} params.action - e.g. 'lead.updated', 'project.deleted'
 * @param {string} params.entity - e.g. 'lead', 'project'
 * @param {string} params.entityId - UUID of the entity
 * @param {Object} [params.oldValue] - previous state
 * @param {Object} [params.newValue] - new state
 * @param {string} [params.ipAddress]
 */
async function logAudit({ tenantId, userId, action, entity, entityId, oldValue, newValue, ipAddress }) {
  if (!tenantId || !action || !entity) {
    console.error('[AuditLogger] Missing required fields', { tenantId, action, entity });
    return;
  }

  try {
    const query = `
      INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, old_value, new_value, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    const oldValStr = oldValue ? JSON.stringify(oldValue) : null;
    const newValStr = newValue ? JSON.stringify(newValue) : null;

    // We do this asynchronously to avoid blocking the main request thread
    pool.query(query, [
      tenantId,
      userId || null,
      action,
      entity,
      entityId || null,
      oldValStr,
      newValStr,
      ipAddress || null
    ]).catch(err => {
      console.error('[AuditLogger] DB Insert failed:', err);
    });

  } catch (error) {
    console.error('[AuditLogger] Failed to log audit event:', error);
  }
}

/**
 * Middleware that automatically logs generic write operations (POST, PUT, PATCH, DELETE).
 * For fine-grained old/new value tracking, use logAudit() directly in the controller instead.
 */
function auditMiddleware(req, res, next) {
  // Only log mutations automatically
  if (['POST', 'PUT', 'PATCH', 'DELETE'].includes(req.method)) {
    // Wait for the response to finish
    res.on('finish', () => {
      // Only log successful actions by default (or log failures explicitly if needed)
      if (res.statusCode >= 200 && res.statusCode < 400) {
        const tenantId = req.tenantId || (req.user && req.user.tenantId);
        const userId = req.user ? (req.user.id || req.user.userId) : null;
        
        if (tenantId) {
          logAudit({
            tenantId,
            userId,
            action: `api.${req.method.toLowerCase()}`,
            entity: 'api_route',
            entityId: null,
            oldValue: null,
            newValue: { path: req.originalUrl, body: req.method !== 'DELETE' ? req.body : null },
            ipAddress: req.ip || req.connection?.remoteAddress
          });

          // Trigger V4 Threat Engine analysis asynchronously
          const { analyzeThreat } = require('../services/security/threatEngine');
          analyzeThreat(tenantId, userId, `api.${req.method.toLowerCase()}`).catch(e => console.error(e));
        }
      }
    });
  }
  next();
}

module.exports = {
  logAudit,
  auditMiddleware
};
