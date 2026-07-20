const pool = require('../db/pool');

/**
 * Logs an activity into the audit_logs table.
 * 
 * @param {Object} req - The Express request object (to extract IP, user, browser)
 * @param {string} entity - The entity type (e.g. 'financial_approval')
 * @param {string} entity_id - The ID of the entity
 * @param {string} action - The action performed (Created, Viewed, Opened, Edited, Assigned, Commented, Approved, Rejected, Reopened, Downloaded, Exported)
 * @param {string} old_value - JSON string of old state (optional)
 * @param {string} new_value - JSON string of new state (optional)
 * @param {string} reason - Optional reason for the action
 */
const logActivity = async (req, entity, entity_id, action, old_value = null, new_value = null, reason = null) => {
  try {
    const tenantId = req.tenantId;
    const userId = req.user?.id || req.user?.userId;
    if (!tenantId || !userId) return;

    // Try to get IP
    let ip = req.headers['x-forwarded-for'] || req.socket?.remoteAddress || '';
    if (ip.includes(',')) ip = ip.split(',')[0].trim();
    if (ip.length > 45) ip = ip.substring(0, 45);

    // Get Browser / User-Agent
    let browser = req.headers['user-agent'] || 'Unknown';
    if (browser.length > 255) browser = browser.substring(0, 255);

    // Parse simple device from User-Agent
    let device = 'Desktop';
    if (/Mobile|Android|iP(hone|od)|IEMobile|BlackBerry|Kindle|Silk-Accelerated|(hpw|web)OS|Opera M(obi|ini)/.test(browser)) {
      device = 'Mobile';
    } else if (/(tablet|ipad|playbook|silk)|(android(?!.*mobi))/i.test(browser)) {
      device = 'Tablet';
    }

    // Try to get location (if provided via cloudflare header or custom header)
    let location = req.headers['cf-ipcountry'] || req.headers['x-vercel-ip-country'] || req.headers['x-client-geo-location'] || 'Unknown';
    
    const query = `
      INSERT INTO audit_logs (tenant_id, user_id, action, entity, entity_id, old_value, new_value, ip_address, browser, device, location, reason)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, $11, $12)
    `;
    await pool.query(query, [
      tenantId,
      userId,
      action,
      entity,
      entity_id,
      old_value,
      new_value,
      ip,
      browser,
      device,
      location,
      reason
    ]);
  } catch (error) {
    console.error('Failed to log activity:', error);
  }
};

module.exports = {
  logActivity
};
