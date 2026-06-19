const express = require('express');
const router = express.Router();
const authenticate = require('../middleware/authenticate');
const pool = require('../db/pool');
const { success, fail } = require('../utils/response');

// Get user's custom views
router.get('/', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user.tenantId;
    const userId = req.user.userId || req.user.id;

    const query = `
      SELECT * FROM user_views
      WHERE tenant_id = $1 AND user_id = $2
      ORDER BY created_at DESC
    `;
    const result = await pool.query(query, [tenantId, userId]);
    
    return success(res, result.rows);
  } catch (error) {
    next(error);
  }
});

// Create a new view
router.post('/', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user.tenantId;
    const userId = req.user.userId || req.user.id;
    const { name, module, view_state, is_default } = req.body;

    const query = `
      INSERT INTO user_views (tenant_id, user_id, name, module, view_state, is_default)
      VALUES ($1, $2, $3, $4, $5, $6)
      RETURNING *
    `;
    const result = await pool.query(query, [
      tenantId, userId, name, module || 'leads', JSON.stringify(view_state), is_default || false
    ]);

    return success(res, result.rows[0], {}, 201);
  } catch (error) {
    next(error);
  }
});

// Update a view
router.patch('/:id', authenticate, async (req, res, next) => {
  try {
    const { id } = req.params;
    const tenantId = req.tenantId || req.user.tenantId;
    const userId = req.user.userId || req.user.id;
    const { name, view_state, is_default } = req.body;

    const query = `
      UPDATE user_views 
      SET name = COALESCE($1, name),
          view_state = COALESCE($2, view_state),
          is_default = COALESCE($3, is_default),
          updated_at = CURRENT_TIMESTAMP
      WHERE id = $4 AND tenant_id = $5 AND user_id = $6
      RETURNING *
    `;
    const result = await pool.query(query, [
      name, view_state ? JSON.stringify(view_state) : null, is_default, id, tenantId, userId
    ]);

    if (result.rows.length === 0) return fail(res, 'NOT_FOUND', 'View not found', 404);
    
    return success(res, result.rows[0]);
  } catch (error) {
    next(error);
  }
});

// Delete a view
router.delete('/:id', authenticate, async (req, res, next) => {
  try {
    const tenantId = req.tenantId || req.user.tenantId;
    const userId = req.user.userId;
    const { id } = req.params;

    const query = `DELETE FROM user_views WHERE id = $1 AND tenant_id = $2 AND user_id = $3`;
    const result = await pool.query(query, [id, tenantId, userId]);

    if (result.rowCount === 0) return fail(res, 'View not found or unauthorized', 404);
    return success(res, null, 'View deleted');
  } catch (error) {
    next(error);
  }
});

module.exports = router;
