
const pool = require('../config/db');

async function sendNotification(tenantId, userId, type, message, referenceUrl = null, actorId = null) {
  if (!userId) return;
  try {
    await pool.query(
      'INSERT INTO notifications (tenant_id, user_id, type, message, reference_url, actor_id) VALUES ($1, $2, $3, $4, $5, $6)',
      [tenantId, userId, type, message, referenceUrl, actorId]
    );
    // Mock Email Output
    console.log(`[EMAIL MOCK] To: User(${userId}) | Subject: New ${type} Notification | Body: ${message} | Link: ${referenceUrl || '#'}`);
  } catch (err) {
    console.error('Error sending notification', err);
  }
}

module.exports = { sendNotification };
