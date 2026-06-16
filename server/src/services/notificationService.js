const pool = require('../config/db');

async function createNotification({ tenantId, userId, type, message, referenceUrl, actorId, actorName }) {
  try {
    await pool.query(`
      INSERT INTO notifications (tenant_id, user_id, type, message, reference_url, actor_id, actor_name)
      VALUES ($1, $2, $3, $4, $5, $6, $7)
    `, [tenantId, userId, type, message, referenceUrl, actorId, actorName]);
  } catch (error) {
    console.error('[Notification Error] createNotification failed:', error);
  }
}

module.exports = {
  createNotification
};
