const logger = require('../utils/logger');
const pool = require('../db/pool');

/**
 * Utility to write an audit log entry.
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} params.userId
 * @param {string} params.action - error.g. 'lead.updated', 'project.deleted'
 * @param {string} params.entity - error.g. 'lead', 'project'
 * @param {string} params.entityId - UUID of the entity
 * @param {Object} [params.oldValue] - previous state
 * @param {Object} [params.newValue] - new state
 * @param {string} [params.ipAddress]
 */
async function logAudit({ tenantId, userId, action, entity, entityId, oldValue, newValue, ipAddress }) {
  if (!tenantId || !action || !entity) {
    logger.error('[AuditLogger] Missing required fields', { tenantId, action, entity });
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
    ]).catch(error => {
      logger.error('[AuditLogger] DB Insert failed:', error);
    });

  } catch (error) {
    logger.error('[AuditLogger] Failed to log audit event:', error);
  }
}

function inferActionFromRoute(method, path) {
  const cleanPath = (path || '').toLowerCase();
  const m = method ? method.toUpperCase() : 'POST';

  if (cleanPath.includes('/auth/login')) return { action: 'user.login', entity: 'user' };
  if (cleanPath.includes('/auth/logout') || cleanPath.includes('/sessions')) return { action: 'user.logout', entity: 'user' };
  if (cleanPath.includes('/users') || cleanPath.includes('/employees') || cleanPath.includes('/team')) {
    if (m === 'POST') return { action: 'employee.created', entity: 'user' };
    if (m === 'PATCH' || m === 'PUT') return { action: 'user.profile_updated', entity: 'user' };
    if (m === 'DELETE') return { action: 'employee.deleted', entity: 'user' };
    return { action: 'user.profile_updated', entity: 'user' };
  }
  if (cleanPath.includes('/projects')) {
    if (m === 'POST') return { action: 'project.created', entity: 'project' };
    if (m === 'PATCH' || m === 'PUT') return { action: 'project.updated', entity: 'project' };
    if (m === 'DELETE') return { action: 'project.archived', entity: 'project' };
    return { action: 'project.updated', entity: 'project' };
  }
  if (cleanPath.includes('/tasks')) {
    if (m === 'POST') return { action: 'task.created', entity: 'task' };
    if (m === 'PATCH' || m === 'PUT') return { action: 'task.status_changed', entity: 'task' };
    if (m === 'DELETE') return { action: 'task.deleted', entity: 'task' };
    return { action: 'task.updated', entity: 'task' };
  }
  if (cleanPath.includes('/leads')) {
    if (m === 'POST') return { action: 'lead.created', entity: 'lead' };
    if (m === 'PATCH' || m === 'PUT') return { action: 'lead.updated', entity: 'lead' };
    if (m === 'DELETE') return { action: 'lead.deleted', entity: 'lead' };
    return { action: 'lead.updated', entity: 'lead' };
  }
  if (cleanPath.includes('/invoices') || cleanPath.includes('/payments') || cleanPath.includes('/milestones')) {
    if (m === 'POST') return { action: 'payment.recorded', entity: 'payment' };
    return { action: 'payment.updated', entity: 'payment' };
  }
  if (cleanPath.includes('/documents') || cleanPath.includes('/files')) {
    return { action: 'document.uploaded', entity: 'document' };
  }

  const segments = cleanPath.split('/').filter(Boolean);
  const resource = segments.find(s => !['api', 'v1', 'v2'].includes(s)) || 'record';
  const op = m === 'POST' ? 'created' : m === 'DELETE' ? 'deleted' : 'updated';
  return { action: `${resource}.${op}`, entity: resource };
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
          const inferred = inferActionFromRoute(req.method, req.originalUrl);
          logAudit({
            tenantId,
            userId,
            action: inferred.action,
            entity: inferred.entity,
            entityId: null,
            oldValue: null,
            newValue: { path: req.originalUrl, body: req.method !== 'DELETE' ? req.body : null },
            ipAddress: req.ip || req.connection?.remoteAddress
          });

          // Trigger V4 Threat Engine analysis asynchronously
          const { analyzeThreat } = require('../services/security/threatEngine');
          analyzeThreat(tenantId, userId, inferred.action).catch(error => logger.error(error));
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
