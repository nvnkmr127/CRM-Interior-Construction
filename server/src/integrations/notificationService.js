const pool = require('../config/db');
const { v4: _uuidv4 } = require('uuid'); // assuming uuid is not installed, wait better-sqlite3 handles uuids manually if needed, or we use pool.query to let db handle it or just crypto.randomUUID if node 15+

// To support Node v14+ natively without extra deps
const crypto = require('crypto');

// Map of userId -> Set of Express Response objects (SSE streams)
const clients = new Map();

/**
 * Register a client for SSE
 * @param {string} userId
 * @param {object} res Express response object
 */
const addClient = (userId, res) => {
  if (!clients.has(userId)) {
    clients.set(userId, new Set());
  }
  clients.get(userId).add(res);

  res.on('close', () => {
    removeClient(userId, res);
  });
};

/**
 * Remove a client from SSE
 * @param {string} userId 
 * @param {object} res 
 */
const removeClient = (userId, res) => {
  const userClients = clients.get(userId);
  if (userClients) {
    userClients.delete(res);
    if (userClients.size === 0) {
      clients.delete(userId);
    }
  }
};

/**
 * Send a payload to all connected streams for a specific user
 * @param {string} userId 
 * @param {object} payload 
 */
const pushToUser = (userId, payload) => {
  const userClients = clients.get(userId);
  if (userClients) {
    for (const res of userClients) {
      res.write(`data: ${JSON.stringify(payload)}\n\n`);
    }
  }
};

/**
 * Insert a notification into DB and broadcast to user
 * @param {string} tenantId
 * @param {string} userId
 * @param {object} notification { title, body, type, lead_id?, actor_id? }
 */
const notifyUser = async (tenantId, userId, notification) => {
  const { title, body, type, lead_id, actor_id } = notification;
  const id = crypto.randomUUID ? crypto.randomUUID() : Math.random().toString(36).substring(2);

  try {
    // 1. Check user preferences to see if they muted this type
    const prefRes = await pool.query('SELECT * FROM user_preferences WHERE user_id = $1 AND tenant_id = $2', [userId, tenantId]);
    const prefs = prefRes.rows[0] || {};
    
    // Check DND Window
    if (prefs.dnd_start_time && prefs.dnd_end_time) {
      const now = new Date();
      const currentHours = now.getHours();
      const currentMins = now.getMinutes();
      const currentTimeStr = `${currentHours.toString().padStart(2, '0')}:${currentMins.toString().padStart(2, '0')}`;
      
      let _inDnd = false;
      if (prefs.dnd_start_time > prefs.dnd_end_time) {
        // spans midnight e.g. 22:00 to 08:00
        if (currentTimeStr >= prefs.dnd_start_time || currentTimeStr <= prefs.dnd_end_time) _inDnd = true;
      } else {
        if (currentTimeStr >= prefs.dnd_start_time && currentTimeStr <= prefs.dnd_end_time) _inDnd = true;
      }
      
      // If in DND, we could choose to skip pushing altogether or just insert silently.
      // We will still insert, but let frontend handle no-sound.
    }

    // 2. Insert into notifications table
    await pool.query(`
      INSERT INTO notifications (id, tenant_id, user_id, title, body, type, lead_id, actor_id, created_at, updated_at)
      VALUES ($1, $2, $3, $4, $5, $6, $7, $8, CURRENT_TIMESTAMP, CURRENT_TIMESTAMP)
    `, [id, tenantId, userId, title, body, type, lead_id, actor_id]);

    const newNotification = {
      id,
      tenant_id: tenantId,
      user_id: userId,
      title,
      body,
      type,
      lead_id,
      actor_id,
      is_read: false,
      created_at: new Date().toISOString()
    };

    // 3. Push to connected clients via SSE
    pushToUser(userId, newNotification);

    return newNotification;
  } catch (error) {
    console.error('Failed to dispatch notification:', error);
    throw error;
  }
};

module.exports = {
  addClient,
  removeClient,
  notifyUser
};
