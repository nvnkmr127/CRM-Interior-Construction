const pool = require('../db/pool');

/**
 * Logs an action to the audit_logs table.
 * Designed to be best-effort; it NEVER throws an error to the caller.
 *
 * @param {Object} params
 * @param {string} params.tenantId
 * @param {string} [params.userId]
 * @param {string} params.action - e.g. 'lead.created', 'task.status_changed'
 * @param {string} params.entity - e.g. 'lead', 'project', 'task'
 * @param {string} [params.entityId]
 * @param {Object} [params.oldValue]
 * @param {Object} [params.newValue]
 * @param {string} [params.ip]
 */
async function logAction({ tenantId, userId, action, entity, entityId, oldValue, newValue, ip }) {
  try {
    const query = `
      INSERT INTO audit_logs (
        tenant_id, user_id, action, entity, entity_id, old_value, new_value, ip_address
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;

    await pool.query(query, [
      tenantId,
      userId || null,
      action,
      entity,
      entityId || null,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      ip || null
    ]);
  } catch (error) {
    // Best-effort logging: NEVER throw, just record it server-side.
    console.error('Audit Log Fire-and-Forget Error:', error);
  }
}

module.exports = {
  logAction,
};
