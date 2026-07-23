const express = require('express');
const pool = require('../config/db');
const authorize = require('../middleware/authorize');
const { success, fail } = require('../utils/response');

const router = express.Router();

router.get('/:module', authorize('users:manage'), async (req, res, next) => {
  const tenantId = req.tenantId;
  const userId = req.user.userId;
  const moduleName = req.params.module;

  try {
    const { rows } = await pool.query(`
      SELECT id, name, filter_state, created_at
      FROM saved_filters
      WHERE tenant_id = $1 AND user_id = $2 AND module = $3
      ORDER BY name ASC
    `, [tenantId, userId, moduleName]);
    
    return success(res, rows);
  } catch (err) {
    next(err);
  }
});

router.post('/', authorize('users:manage'), async (req, res, next) => {
  const tenantId = req.tenantId;
  const userId = req.user.userId;
  const { module, name, filter_state } = req.body;

  if (!module || !name || !filter_state) {
    return fail(res, 'BAD_REQUEST', 'Missing required fields', 400);
  }

  try {
    const { rows } = await pool.query(`
      INSERT INTO saved_filters (tenant_id, user_id, module, name, filter_state)
      VALUES ($1, $2, $3, $4, $5)
      RETURNING id, name, filter_state, created_at
    `, [tenantId, userId, module, name, JSON.stringify(filter_state)]);

    return success(res, rows[0]);
  } catch (err) {
    next(err);
  }
});

router.delete('/:id', authorize('users:manage'), async (req, res, next) => {
  const tenantId = req.tenantId;
  const userId = req.user.userId;
  const filterId = req.params.id;

  try {
    const { rowCount } = await pool.query(`
      DELETE FROM saved_filters
      WHERE id = $1 AND tenant_id = $2 AND user_id = $3
    `, [filterId, tenantId, userId]);

    if (rowCount === 0) {
      return fail(res, 'NOT_FOUND', 'Saved filter not found', 404);
    }
    
    return success(res, { message: 'Filter deleted' });
  } catch (err) {
    next(err);
  }
});

module.exports = router;
