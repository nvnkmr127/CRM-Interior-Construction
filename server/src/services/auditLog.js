const pool = require('../db/pool');
const asyncLocalStorage = require('../utils/requestContext');
const UAParser = require('ua-parser-js');

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
    const store = asyncLocalStorage.getStore();
    const req = store ? store.req : null;
    
    const finalIp = ip || (req ? (req.headers['x-forwarded-for'] || req.socket.remoteAddress) : null);
    const userAgentStr = req ? req.headers['user-agent'] : null;
    
    let browser = null;
    let device = null;
    
    if (userAgentStr) {
      const parser = new UAParser(userAgentStr);
      const b = parser.getBrowser();
      const os = parser.getOS();
      const dev = parser.getDevice();
      
      browser = (b.name ? `${b.name} ${b.version || ''}` : null);
      
      if (dev.type) {
        device = `${dev.vendor || ''} ${dev.model || ''} (${dev.type})`.trim();
      } else if (os.name) {
        device = `${os.name} ${os.version || ''}`.trim();
      }
      
      if (browser) browser = browser.trim();
      if (device) device = device.trim();
    }

    const query = `
      INSERT INTO audit_logs (
        tenant_id, user_id, action, entity, entity_id, old_value, new_value, ip_address, user_agent, browser, device
      )
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11)
    `;

    await pool.query(query, [
      tenantId,
      userId || null,
      action,
      entity,
      entityId || null,
      oldValue ? JSON.stringify(oldValue) : null,
      newValue ? JSON.stringify(newValue) : null,
      finalIp || null,
      userAgentStr || null,
      browser || null,
      device || null
    ]);
  } catch (error) {
    // Best-effort logging: NEVER throw, just record it server-side.
    console.error('Audit Log Fire-and-Forget Error:', error);
  }
}

module.exports = {
  logAction,
};
