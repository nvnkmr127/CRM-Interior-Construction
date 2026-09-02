const pool = require('../config/db');
const crypto = require('crypto');
const { queueEmail } = require('../services/emailService');
const logger = require('../utils/logger');

const clients = new Map();

const addClient = (userId, res) => {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId).add(res);

  res.on('close', () => {
    removeClient(userId, res);
  });
};

const removeClient = (userId, res) => {
  const userClients = clients.get(userId);
  if (userClients) {
    userClients.delete(res);
    if (userClients.size === 0) {
      clients.delete(userId);
    }
  }
};

const pushToUser = (userId, payload) => {
  const userClients = clients.get(userId);
  if (userClients) {
    for (const res of userClients) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  }
};

const notifyUser = async (tenantId, userId, notification) => {
  if (!userId) return null;
  const { title, body, message, type = 'notification', lead_id, actor_id, actor_name, reference_url } = notification;
  const msgText = message || body || '';
  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);

  try {
    const prefRes = await pool.query('SELECT * FROM user_preferences WHERE user_id = $1 AND tenant_id = $2', [userId, tenantId]);
    const prefs = prefRes.rows[0] || {};
    
    let inDnd = false;
    if (prefs.dnd_start_time && prefs.dnd_end_time) {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMins = now.getMinutes();
      const currentTimeStr = `${currentHours.toString().padStart(2, '0')}:${currentMins.toString().padStart(2, '0')}`;
      
      if (prefs.dnd_start_time > prefs.dnd_end_time) {
        if (currentTimeStr >= prefs.dnd_start_time || currentTimeStr <= prefs.dnd_end_time) inDnd = true;
      } else {
        if (currentTimeStr >= prefs.dnd_start_time && currentTimeStr <= prefs.dnd_end_time) inDnd = true;
      }
    }

    await pool.query(`
      INSERT INTO notifications (id, tenant_id, user_id, title, message, type, lead_id, actor_id, actor_name, reference_url, created_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, $9, $10, CURRENT_TIMESTAMP)
    `, [id, tenantId, userId, title || 'Notification', msgText, type, lead_id || null, actor_id || null, actor_name || null, reference_url || null]);

    const newNotification = {
      id,
      tenant_id: tenantId,
      user_id: userId,
      title: title || 'Notification',
      body: msgText,
      message: msgText,
      type,
      lead_id: lead_id || null,
      actor_id: actor_id || null,
      actor_name: actor_name || null,
      reference_url: reference_url || null,
      is_read: false,
      created_at: new Date().toISOString(),
      suppress_push: inDnd || prefs.push_score_changes === false
    };

    // Push to SSE (strictly isolated to this user)
    pushToUser(userId, newNotification);

    // Dispatch Email if not explicitly disabled AND not in DND
    if (prefs.email_sla_breaches !== false && !inDnd) {
      const userRes = await pool.query('SELECT email FROM users WHERE id=$1', [userId]);
      if (userRes.rows[0]?.email) {
        await queueEmail(
          tenantId,
          userId,
          userRes.rows[0].email,
          title || 'New Notification',
          'test_override',
          { htmlOverride: msgText }
        ).catch(err => logger.error('[notifyUser] queueEmail error:', err.message));
      }
    }

    return newNotification;
  } catch (error) {
    logger.error('Failed to dispatch notification:', error);
    throw error;
  }
};

module.exports = {
  addClient,
  removeClient,
  notifyUser
};
