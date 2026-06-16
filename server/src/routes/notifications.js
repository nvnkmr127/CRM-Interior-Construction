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

    res.json(success(rows));
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

    res.json(success({ count: parseInt(rows[0].count, 10) }));
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

module.exports = router;
