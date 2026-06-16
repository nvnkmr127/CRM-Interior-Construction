const { pool } = require('../db/pool')

/**
 * Fire-and-forget notification creation.
 * Never throws — notification failure never blocks the main request.
 */
async function createNotification({
  tenantId, userId, type, message, referenceUrl = null,
  actorId = null, actorName = null
}) {
  try {
    await pool.query(
      `INSERT INTO notifications
       (tenant_id, user_id, type, message, reference_url, actor_id, actor_name)
       VALUES ($1,$2,$3,$4,$5,$6,$7)`,
      [tenantId, userId, type, message, referenceUrl, actorId, actorName]
    )
  } catch (err) {
    console.error('[notificationService] failed to create notification:', err.message)
  }
}

/**
 * Notify a specific user with setImmediate (non-blocking).
 * Usage: notifyUser({ tenantId, userId, type, message, referenceUrl, actorId, actorName })
 */
function notifyUser(params) {
  setImmediate(() => createNotification(params))
}

module.exports = { notifyUser }
