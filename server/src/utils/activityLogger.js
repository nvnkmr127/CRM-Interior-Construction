const logger = require('../utils/logger');
const pool = require('../db/pool');
/**
 * Logs an activity into the audit_logs table.
 * 
 * @param {Object} req - The Express request object (to extract IP, user, browser)
 * @param {string} entity - The entity type (error.g. 'financial_approval')
 * @param {string} entity_id - The ID of the entity
 * @param {string} action - The action performed (Created, Viewed, Opened, Edited, Assigned, Commented, Approved, Rejected, Reopened, Downloaded, Exported)
 * @param {string} old_value - JSON string of old state (optional)
 * @param {string} new_value - JSON string of new state (optional)
 * @param {string} reason - Optional reason for the action
 */
const logActivity = async (req, entity, entity_id, action, old_value = null, new_value = null, reason = null) => {
  try {
    const tenantId = req.tenantId || (req.user && (req.user.tenantId || req.user.tenant_id));
    const userId = req.user?.id || req.user?.userId;
    const isUuid = (str) => typeof str === 'string' && /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(str);
    if (!tenantId || !userId || !isUuid(userId)) return;

    // Try to get IP
    let ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    if (ip.includes(',')) ip = ip.split(',')[0].trim();
    if (ip.length > 45) ip = ip.substring(0, 45);

    const query = `
      INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, old_value, new_value, ip_address)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8)
    `;
    await pool.query(query, [
      tenantId,
      userId,
      action,
      entity,
      isUuid(entity_id) ? entity_id : null,
      typeof old_value === 'object' ? JSON.stringify(old_value) : old_value,
      typeof new_value === 'object' ? JSON.stringify(new_value) : new_value,
      ip
    ]);
  } catch (error) {
    logger.error('Failed to log activity:', error);
  }
};

module.exports = {
  logActivity
};
