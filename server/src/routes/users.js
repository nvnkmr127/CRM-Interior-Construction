const express = require('express');
const { success, fail } = require('../utils/response');
const authenticate = require('../middleware/authenticate');
const pool = require('../db/pool');

const router = express.Router();
router.use(authenticate);

// GET /api/users — list active users in the tenant (used for assignee dropdowns)
router.get('/', async (req, res, next) => {
  try {
    const { rows } = await pool.query(
      'SELECT id, name, email, avatar_url FROM users WHERE tenant_id = $1 AND status = $2 ORDER BY name ASC',
      [req.tenantId, 'active']
    );
    const safeUsers = rows.map(({ id, name, email, avatar_url }) => ({ id, name, email, avatar_url }));
    return success(res, safeUsers);
  } catch (err) {
    console.error('[Users Router] List error:', err);
    return fail(res, 'INTERNAL_ERROR', 'Failed to fetch users.', 500);
  }
});

module.exports = router;
