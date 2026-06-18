const express = require('express');
const authenticate = require('../middleware/authenticate');
const { success, fail } = require('../utils/response');
const pool = require('../config/db');

const router = express.Router();

router.use(authenticate);

router.get('/', async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const limit = parseInt(req.query.limit, 10) || 20;

  try {
    const { rows } = await pool.query(`
      SELECT n.*, u.avatar_url as actor_avatar
      FROM notifications n LEFT JOIN users u ON u.id=n.actor_id
      WHERE n.tenant_id=$1 AND n.user_id=$2
      ORDER BY n.created_at DESC LIMIT $3
    `, [tenantId, userId, limit]);

    return success(res, rows);
  } catch (error) {
    res.status(500).json(fail('Notifications fetch failed'));
  }
});

router.get('/unread-count', async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;

  try {
    const { rows } = await pool.query(`
      SELECT COUNT(*) FROM notifications
      WHERE tenant_id=$1 AND user_id=$2 AND is_read=false
    `, [tenantId, userId]);

    return success(res, { count: parseInt(rows[0].count, 10) });
  } catch (error) {
    res.status(500).json(fail('Unread count fetch failed'));
  }
});

router.post('/mark-read', async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const { ids, all } = req.body;

  try {
    if (all) {
      await pool.query(`
        UPDATE notifications SET is_read=true
        WHERE user_id=$2 AND tenant_id=$1
      `, [tenantId, userId]);
    } else if (Array.isArray(ids) && ids.length > 0) {
      await pool.query(`
        UPDATE notifications SET is_read=true
        WHERE id=ANY($3::uuid[]) AND user_id=$2 AND tenant_id=$1
      `, [tenantId, userId, ids]);
    }

    res.status(204).send();
  } catch (error) {
    res.status(500).json(fail('Mark read failed'));
  }
});

const { addClient } = require('../integrations/notificationService');

router.get('/stream', (req, res) => {
  const userId = req.user.id;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');

  // Register client
  addClient(userId, res);

  // Send initial ping to establish connection
  res.write(': connected\n\n');
});

router.get('/preferences', async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  try {
    const { rows } = await pool.query('SELECT * FROM user_preferences WHERE user_id=$1 AND tenant_id=$2', [userId, tenantId]);
    return success(res, rows[0] || {});
  } catch (err) {
    res.status(500).json(fail('Failed to fetch preferences'));
  }
});

router.patch('/preferences', async (req, res) => {
  const tenantId = req.tenantId;
  const userId = req.user.id;
  const { email_sla_breaches, push_score_changes, dnd_start_time, dnd_end_time } = req.body;
  try {
    await pool.query(`
      INSERT INTO user_preferences (user_id, tenant_id, email_sla_breaches, push_score_changes, dnd_start_time, dnd_end_time)
      VALUES ($1, $2, $3, $4, $5, $6)
      ON CONFLICT(user_id) DO UPDATE SET
        email_sla_breaches=EXCLUDED.email_sla_breaches,
        push_score_changes=EXCLUDED.push_score_changes,
        dnd_start_time=EXCLUDED.dnd_start_time,
        dnd_end_time=EXCLUDED.dnd_end_time,
        updated_at=CURRENT_TIMESTAMP
    `, [userId, tenantId, email_sla_breaches ?? true, push_score_changes ?? true, dnd_start_time || '22:00', dnd_end_time || '08:00']);
    return success(res, { message: 'Preferences updated' });
  } catch (err) {
    res.status(500).json(fail('Failed to update preferences'));
  }
});

module.exports = router;
